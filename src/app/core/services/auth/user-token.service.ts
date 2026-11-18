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
} from './refresh-error.util';

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

	private refreshObservable: Observable<{
		accessToken: string;
		refreshToken?: string;
		csrfToken?: string;
	}> | null = null;
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
						this.autoRefreshFailureCount = 0;
						this.scheduleAutoRefresh();
					}
				} else if (message.type === 'TOKEN_REMOVE') {
					this.stopAutoRefresh();
					this.autoRefreshFailureCount = 0;
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
		this.autoRefreshFailureCount = 0;
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
		this.autoRefreshFailureCount = 0;
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
			this.notificationService.show(
				'Sua sessão expirou por inatividade. Por favor, faça login novamente.',
				'warning',
			);
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

	private scheduleAutoRefresh(delayOverrideMs?: number) {
		if (!isPlatformBrowser(this.platformId) || !this.accessToken) return;
		this.clearRefreshTimer();

		if (delayOverrideMs !== undefined) {
			this.ngZone.runOutsideAngular(() => {
				this.refreshSubscription = timer(delayOverrideMs).subscribe(
					() => {
						this.ngZone.run(() => this.executeAutoRefresh(true));
					},
				);
			});
			return;
		}

		try {
			const { exp } = jwtDecode<payloadToken>(this.accessToken);
			if (!exp) return;

			const expiresAtMs = exp * 1000;
			const nowMs = Date.now();
			const marginMs = this.REFRESH_MARGIN_SEC * 1000;
			const timeToRefresh = expiresAtMs - nowMs - marginMs;

			if (timeToRefresh > 0) {
				const jitter = Math.floor(Math.random() * 5000);
				this.ngZone.runOutsideAngular(() => {
					this.refreshSubscription = timer(
						timeToRefresh + jitter,
					).subscribe(() => {
						this.ngZone.run(() => this.executeAutoRefresh(true));
					});
				});
			} else {
				this.ngZone.runOutsideAngular(() => {
					this.refreshSubscription = timer(5000).subscribe(() => {
						this.ngZone.run(() => this.executeAutoRefresh(false));
					});
				});
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
		this.scheduleAutoRefresh(this.AUTO_REFRESH_BACKOFF_MS[index]);
	}

	private clearRefreshTimer() {
		if (this.refreshSubscription) {
			this.refreshSubscription.unsubscribe();
			this.refreshSubscription = undefined;
		}
	}

	private stopAutoRefresh() {
		this.autoRefreshFailureCount = 0;
		this.clearRefreshTimer();
	}

	refreshTokens(): Observable<{
		accessToken: string;
		refreshToken?: string;
		csrfToken?: string;
	}> {
		if (this.refreshObservable) {
			return this.refreshObservable;
		}

		const csrfToken = this.csrfToken?.trim();

		if (!csrfToken) {
			return throwError(
				() =>
					new Error(
						'CRITICAL: Token CSRF não encontrado para refresh',
					),
			);
		}

		const initialAccessToken = this._accessToken();

		// O fonte HTTP inclui tap, retries e finalize antes do shareReplay.
		// Assim, refreshObservable só é limpo quando o fluxo completa
		// (não quando um subscriber individual cancela a subscription).
		const source = this.executeRefreshAttempt(
			csrfToken,
			initialAccessToken,
			0,
			0,
		).pipe(
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

	private executeRefreshAttempt(
		csrfToken: string,
		initialAccessToken: string | null,
		conflictRetries: number,
		csrfRetries: number,
	): Observable<{
		accessToken: string;
		refreshToken?: string;
		csrfToken?: string;
	}> {
		return this.http
			.post<{
				accessToken: string;
				refreshToken?: string;
				csrfToken?: string;
			}>('/auth/refresh', null, {
				withCredentials: true,
				headers: { 'x-csrf-token': csrfToken },
			})
			.pipe(
				tap((body) => {
					if (body?.accessToken) {
						this.setTokens(body.accessToken, body.csrfToken);
					}
				}),
				catchError((err) => {
					if (isRefreshInProgressError(err) && conflictRetries < 1) {
						const waitSeconds = parseRetryAfterSeconds(
							err,
							1,
							0,
							5,
						);
						return timer(waitSeconds * 1000).pipe(
							switchMap(() => {
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
								const latestCsrf =
									this.csrfToken?.trim() || csrfToken;
								return this.executeRefreshAttempt(
									latestCsrf,
									initialAccessToken,
									conflictRetries + 1,
									csrfRetries,
								);
							}),
						);
					}

					if (isCsrfTokenInvalidError(err)) {
						if (csrfRetries < 1) {
							const freshCsrf = this.csrfToken?.trim();
							if (freshCsrf) {
								return this.executeRefreshAttempt(
									freshCsrf,
									initialAccessToken,
									conflictRetries,
									csrfRetries + 1,
								);
							}
						}
						this.ngZone.run(() => {
							this.notificationService.show(
								'Não foi possível validar o token de segurança (CSRF). Tente novamente.',
								'warning',
							);
						});
						return throwError(() => err);
					}

					return throwError(() => err);
				}),
			);
	}

	get isAdmin(): boolean {
		return this.isAdminSignal();
	}
}
