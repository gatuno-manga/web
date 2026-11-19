import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
	computed,
	DestroyRef,
	Injectable,
	inject,
	NgZone,
	PLATFORM_ID,
	signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NotificationService } from '@core/services/notification/notification.service';
import {
	AuthSyncMessage,
	CrossTabSyncService,
} from '@core/services/storage/cross-tab-sync.service';
import { payloadToken, Role } from '@models/user.models';
import { jwtDecode } from 'jwt-decode';
import { Observable, of, Subscription, throwError, timer } from 'rxjs';
import {
	catchError,
	finalize,
	shareReplay,
	switchMap,
	tap,
} from 'rxjs/operators';
import { CookieService } from './cookie.service';
import { CsrfService } from './csrf.service';
import {
	isCsrfTokenInvalidError,
	isDeadSessionRefreshError,
	isRefreshInProgressError,
	parseRetryAfterSeconds,
	retryOnInvalidCsrf,
	SESSION_EXPIRED_MESSAGE,
} from './refresh-error.util';

type RefreshTokenResponse = {
	accessToken: string;
	refreshToken?: string;
	csrfToken?: string;
};

@Injectable({
	providedIn: 'root',
})
export class UserTokenService {
	private http = inject(HttpClient);
	private cookieService = inject(CookieService);
	private csrfService = inject(CsrfService);
	private platformId = inject(PLATFORM_ID);
	private ngZone = inject(NgZone);
	private destroyRef = inject(DestroyRef);
	private crossTabSync = inject(CrossTabSyncService);

	private router = inject(Router);
	private notificationService = inject(NotificationService);

	private readonly ACCESSKEY = 'accessToken';
	private readonly REFRESH_LOCK_KEY = 'gatuno-refresh-lock';
	private readonly SESSION_INTENT_KEY = 'gatuno-session-intent';
	private readonly LOCK_TIMEOUT_MS = 10000;
	private readonly REFRESH_MARGIN_SEC = 60;
	private readonly AUTO_REFRESH_BACKOFF_MS = [
		30_000, 60_000, 120_000, 240_000, 300_000,
	];
	private sessionMayExist = false;
	private autoRefreshFailureCount = 0;
	private csrfWarningShown = false;

	private refreshObservable: Observable<RefreshTokenResponse> | null = null;
	private refreshSubscription?: Subscription;

	private _accessToken = signal<string | null>(null);

	private readonly _decodedToken = computed(() => {
		const token = this._accessToken();
		if (!token) return null;
		try {
			return jwtDecode<payloadToken>(token);
		} catch {
			return null;
		}
	});

	public readonly authHeaderSignal = computed(() => {
		const token = this._accessToken();
		return token ? `Bearer ${token}` : null;
	});

	public readonly accessTokenSignal = this._accessToken.asReadonly();
	public readonly csrfTokenSignal = computed(
		() => this.csrfService.csrfToken,
	);

	public readonly hasValidAccessTokenSignal = computed(() => {
		const decoded = this._decodedToken();
		if (!decoded?.exp) return false;
		return decoded.exp > Math.floor(Date.now() / 1000);
	});

	public readonly isAdminSignal = computed(() => {
		const decoded = this._decodedToken();
		return decoded?.roles?.includes(Role.ADMIN) ?? false;
	});

	public readonly rolesSignal = computed(() => {
		const decoded = this._decodedToken();
		return decoded?.roles ?? [];
	});

	public readonly emailSignal = computed(() => {
		const decoded = this._decodedToken();
		return decoded?.email ?? null;
	});

	public readonly userIdSignal = computed(() => {
		const decoded = this._decodedToken();
		return decoded?.sub ?? null;
	});

	constructor() {
		const initialToken = this.cookieService.get(this.ACCESSKEY, false);
		this._accessToken.set(initialToken);

		if (isPlatformBrowser(this.platformId)) {
			this.sessionMayExist =
				!!initialToken ||
				localStorage.getItem(this.SESSION_INTENT_KEY) === 'true';
		}

		this.initCrossTabSync();

		if (this.accessToken) {
			this.scheduleAutoRefresh();
		}
	}

	private initCrossTabSync(): void {
		this.crossTabSync.messages$
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((message: AuthSyncMessage) => {
				if (message.type === 'TOKEN_UPDATE') {
					this.sessionMayExist = true;
					if (isPlatformBrowser(this.platformId)) {
						localStorage.setItem(this.SESSION_INTENT_KEY, 'true');
					}
					this._accessToken.set(message.accessToken ?? null);

					if (message.csrfToken) {
						this.csrfService.setToken(message.csrfToken);
					}

					if (message.accessToken) {
						this.resetAutoRefreshState();
						this.scheduleAutoRefresh();
					}
				} else if (message.type === 'TOKEN_REMOVE') {
					this.stopAutoRefresh();
					this.sessionMayExist = false;
					if (isPlatformBrowser(this.platformId)) {
						localStorage.removeItem(this.SESSION_INTENT_KEY);
					}
					this._accessToken.set(null);
					this.csrfService.clear();
				}
			});
	}

	setTokens(accessToken: string, csrfToken?: string) {
		this.resetAutoRefreshState();
		this.cookieService.set(this.ACCESSKEY, accessToken, false);
		this.sessionMayExist = true;
		if (isPlatformBrowser(this.platformId)) {
			localStorage.setItem(this.SESSION_INTENT_KEY, 'true');
		}
		this._accessToken.set(accessToken);

		if (csrfToken) {
			this.csrfService.setToken(csrfToken);
		}

		this.scheduleAutoRefresh();
		this.crossTabSync.notifyTokenUpdate(accessToken, csrfToken);
	}

	removeTokens(notifyUser = false): void {
		this.stopAutoRefresh();
		this.cookieService.delete(this.ACCESSKEY, false);

		if (isPlatformBrowser(this.platformId)) {
			const hostname = window.location.hostname;
			const parts = hostname.split('.');

			const domainsToTry = [hostname, `.${hostname}`];
			if (parts.length > 2) {
				domainsToTry.push(`.${parts.slice(-2).join('.')}`);
				domainsToTry.push(`.${parts.slice(-3).join('.')}`);
			}

			for (const domain of domainsToTry) {
				this.cookieService.delete(this.ACCESSKEY, false, domain);
			}
			this.cookieService.delete(this.ACCESSKEY, false);
		}

		this.csrfService.clear();

		this.sessionMayExist = false;
		if (isPlatformBrowser(this.platformId)) {
			localStorage.removeItem(this.SESSION_INTENT_KEY);
		}
		this._accessToken.set(null);

		this.crossTabSync.notifyTokenRemove();

		if (notifyUser) {
			this.handleSessionExpired();
		}
	}

	private handleSessionExpired() {
		this.ngZone.run(() => {
			const returnUrl = this.router.url;
			this.notificationService.show(SESSION_EXPIRED_MESSAGE, 'warning');
			this.router.navigate(['/auth/login'], {
				queryParams: { sessionExpired: 'true', returnUrl },
			});
		});
	}

	get accessToken(): string | null {
		return this._accessToken();
	}

	get refreshToken(): string | null {
		return null;
	}

	get csrfToken(): string | null {
		return this.csrfService.csrfToken;
	}

	get hasValidAccessToken(): boolean {
		return this.hasValidAccessTokenSignal();
	}

	get hasValidRefreshToken(): boolean {
		return this.sessionMayExist;
	}

	private startRefreshTimer(delayMs: number, useCrossTabLock: boolean): void {
		if (!isPlatformBrowser(this.platformId) || !this.accessToken) return;
		this.clearRefreshTimer();
		this.ngZone.runOutsideAngular(() => {
			this.refreshSubscription = timer(delayMs).subscribe(() => {
				this.ngZone.run(() => this.executeAutoRefresh(useCrossTabLock));
			});
		});
	}

	private scheduleAutoRefresh() {
		if (!isPlatformBrowser(this.platformId) || !this.accessToken) return;

		try {
			const { exp } = jwtDecode<payloadToken>(this.accessToken);
			if (!exp) return;

			const expiresAtMs = exp * 1000;
			const nowMs = Date.now();
			const marginMs = this.REFRESH_MARGIN_SEC * 1000;
			const timeToRefresh = expiresAtMs - nowMs - marginMs;

			if (timeToRefresh > 0) {
				const jitter = Math.floor(Math.random() * 5000);
				this.startRefreshTimer(timeToRefresh + jitter, true);
			} else {
				this.startRefreshTimer(5000, false);
			}
		} catch (_e) {
			this.removeTokens(false);
		}
	}

	private executeAutoRefresh(useCrossTabLock: boolean): void {
		if (useCrossTabLock) {
			const lock = localStorage.getItem(this.REFRESH_LOCK_KEY);
			const now = Date.now();

			if (lock && now - parseInt(lock, 10) < this.LOCK_TIMEOUT_MS) {
				this.startRefreshTimer(this.LOCK_TIMEOUT_MS, true);
				return;
			}

			localStorage.setItem(this.REFRESH_LOCK_KEY, now.toString());
		}

		this.refreshTokens()
			.pipe(
				finalize(() => {
					if (useCrossTabLock) {
						localStorage.removeItem(this.REFRESH_LOCK_KEY);
					}
				}),
			)
			.subscribe({
				next: () => {
					this.autoRefreshFailureCount = 0;
				},
				error: (err) => this.handleAutoRefreshError(err),
			});
	}

	private handleAutoRefreshError(err: unknown): void {
		if (isDeadSessionRefreshError(err)) {
			this.removeTokens(true);
			return;
		}

		this.autoRefreshFailureCount += 1;
		const index = Math.min(
			this.autoRefreshFailureCount - 1,
			this.AUTO_REFRESH_BACKOFF_MS.length - 1,
		);
		this.startRefreshTimer(this.AUTO_REFRESH_BACKOFF_MS[index], true);
	}

	private clearRefreshTimer() {
		if (this.refreshSubscription) {
			this.refreshSubscription.unsubscribe();
			this.refreshSubscription = undefined;
		}
	}

	private resetAutoRefreshState(): void {
		this.autoRefreshFailureCount = 0;
		this.csrfWarningShown = false;
	}

	private stopAutoRefresh() {
		this.resetAutoRefreshState();
		this.clearRefreshTimer();
	}

	refreshTokens(): Observable<RefreshTokenResponse> {
		if (this.refreshObservable) {
			return this.refreshObservable;
		}

		if (!this.csrfToken?.trim()) {
			return throwError(
				() =>
					new Error(
						'CRITICAL: Token CSRF não encontrado para refresh',
					),
			);
		}

		const initialAccessToken = this._accessToken();
		const hadSession = this.sessionMayExist;

		// O fonte HTTP inclui tap, retries e finalize antes do shareReplay.
		// Assim, refreshObservable só é limpo quando o fluxo completa
		// (não quando um subscriber individual cancela a subscription).
		const source = this.executeRefreshWithConflictRetry(
			initialAccessToken,
			hadSession,
		).pipe(
			catchError((err) => {
				if (isCsrfTokenInvalidError(err) && !this.csrfWarningShown) {
					this.csrfWarningShown = true;
					this.ngZone.run(() => {
						this.notificationService.show(
							'Não foi possível validar o token de segurança (CSRF). Tente novamente.',
							'warning',
						);
					});
				}
				return throwError(() => err);
			}),
			finalize(() => {
				this.refreshObservable = null;
			}),
		);

		const obs = source.pipe(
			shareReplay({ bufferSize: 1, refCount: false }),
		);

		this.refreshObservable = obs;
		return obs;
	}

	private postRefresh(): Observable<RefreshTokenResponse> {
		const csrfToken = this.csrfToken?.trim();
		if (!csrfToken) {
			return throwError(
				() =>
					new Error(
						'CRITICAL: Token CSRF não encontrado para refresh',
					),
			);
		}
		return this.http
			.post<RefreshTokenResponse>('/auth/refresh', null, {
				withCredentials: true,
				headers: { 'x-csrf-token': csrfToken },
			})
			.pipe(
				tap((body) => {
					if (body?.accessToken) {
						this.setTokens(body.accessToken, body.csrfToken);
					}
				}),
			);
	}

	private executeRefreshWithCsrfRetry(): Observable<RefreshTokenResponse> {
		return retryOnInvalidCsrf(
			() => this.postRefresh(),
			() => !!this.csrfToken?.trim(),
		);
	}

	private executeRefreshWithConflictRetry(
		initialAccessToken: string | null,
		hadSession: boolean,
	): Observable<RefreshTokenResponse> {
		return this.executeRefreshWithCsrfRetry().pipe(
			catchError((err) => {
				if (!isRefreshInProgressError(err)) {
					return throwError(() => err);
				}
				const waitSeconds = parseRetryAfterSeconds(err);
				return timer(waitSeconds * 1000).pipe(
					switchMap(() => {
						const latestCsrf = this.csrfToken?.trim();
						if (
							(hadSession && !this.hasValidRefreshToken) ||
							!latestCsrf
						) {
							return throwError(() => err);
						}
						const currentToken = this._accessToken();
						if (
							currentToken &&
							currentToken !== initialAccessToken
						) {
							return of({
								accessToken: currentToken,
								csrfToken: this.csrfToken ?? undefined,
							});
						}
						return this.executeRefreshWithCsrfRetry();
					}),
				);
			}),
		);
	}

	get isAdmin(): boolean {
		return this.isAdminSignal();
	}
}
