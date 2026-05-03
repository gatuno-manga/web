import {
	Injectable,
	inject,
	PLATFORM_ID,
	NgZone,
	signal,
	computed,
	DestroyRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CookieService } from './cookie.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { payloadToken, Role } from '../models/user.models';
import { Observable, Subscription, throwError, timer, asapScheduler } from 'rxjs';
import {
	shareReplay,
	tap,
	finalize,
	map,
	filter,
	take,
	switchMap,
	catchError,
	throwIfEmpty,
} from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { CrossTabSyncService, AuthSyncMessage } from './cross-tab-sync.service';

@Injectable({
	providedIn: 'root',
})
export class UserTokenService {
	private http = inject(HttpClient);
	private cookieService = inject(CookieService);
	private platformId = inject(PLATFORM_ID);
	private ngZone = inject(NgZone);
	private destroyRef = inject(DestroyRef);
	private crossTabSync = inject(CrossTabSyncService);

	private router = inject(Router);
	private notificationService = inject(NotificationService);

	private readonly ACCESSKEY = 'accessToken';
	private readonly REFRESH_LOCK_KEY = 'gatuno-refresh-lock';
	private readonly LOCK_TIMEOUT_MS = 10000;
	private readonly REFRESH_MARGIN_SEC = 60;
	private sessionMayExist = isPlatformBrowser(this.platformId);

	private refreshObservable: Observable<{
		accessToken: string;
		refreshToken?: string;
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
					this._accessToken.set(message.accessToken ?? null);
					if (message.accessToken) {
						this.scheduleAutoRefresh();
					}
				} else if (message.type === 'TOKEN_REMOVE') {
					this.stopAutoRefresh();
					this.sessionMayExist = false;
					this._accessToken.set(null);
				}
			});
	}

	setTokens(accessToken: string) {
		this.cookieService.set(this.ACCESSKEY, accessToken, false);
		this.sessionMayExist = true;
		this._accessToken.set(accessToken);
		this.scheduleAutoRefresh();
		this.crossTabSync.notifyTokenUpdate(accessToken);
	}

	removeTokens(notifyUser = false): void {
		this.stopAutoRefresh();
		this.cookieService.delete(this.ACCESSKEY, false);
		this.sessionMayExist = false;
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
		return this.cookieService.get('csrfToken', false);
	}

	get hasValidAccessToken(): boolean {
		return this.hasValidAccessTokenSignal();
	}

	get hasValidRefreshToken(): boolean {
		return this.sessionMayExist;
	}

	private isTokenValid(token: string): boolean {
		try {
			const { exp } = jwtDecode<payloadToken>(token);
			if (!exp) return false;
			return exp > Math.floor(Date.now() / 1000);
		} catch {
			return false;
		}
	}

	private scheduleAutoRefresh() {
		if (!isPlatformBrowser(this.platformId) || !this.accessToken) return;
		this.stopAutoRefresh();

		try {
			const { exp } = jwtDecode<payloadToken>(this.accessToken);
			if (!exp) return;

			const expiresAtMs = exp * 1000;
			const nowMs = Date.now();
			const marginMs = this.REFRESH_MARGIN_SEC * 1000;
			const timeToRefresh = expiresAtMs - nowMs - marginMs;

			if (timeToRefresh > 0) {
				const jitter = Math.floor(Math.random() * 5000); // 0-5s jitter
				this.ngZone.runOutsideAngular(() => {
					this.refreshSubscription = timer(
						timeToRefresh + jitter,
					).subscribe(() => {
						this.ngZone.run(() => {
							const lock = localStorage.getItem(this.REFRESH_LOCK_KEY);
							const now = Date.now();

							if (lock && now - parseInt(lock, 10) < this.LOCK_TIMEOUT_MS) {
								// Outra aba já está processando o refresh
								return;
							}

							localStorage.setItem(this.REFRESH_LOCK_KEY, now.toString());

							this.refreshTokens()
								.pipe(
									finalize(() =>
										localStorage.removeItem(this.REFRESH_LOCK_KEY),
									),
								)
								.subscribe({
									error: () => {
										console.warn(
											'Auto-refresh falhou. Encerrando sessão.',
										);
										this.removeTokens(true);
									},
								});
						});
					});
				});
			} else {
				// Tenta refresh imediato mesmo se já expirou (ou está na margem)
				// Usamos asapScheduler para garantir que, se chamado dentro de um refreshTokens atual,
				// a requisição anterior termine e limpe o refreshObservable antes da nova tentativa.
				asapScheduler.schedule(() => {
					this.refreshTokens().subscribe({
						error: () => this.removeTokens(true),
					});
				});
			}
		} catch (e) {
			console.error(e);
			this.removeTokens(false);
		}
	}

	private stopAutoRefresh() {
		if (this.refreshSubscription) {
			this.refreshSubscription.unsubscribe();
			this.refreshSubscription = undefined;
		}
	}

	refreshTokens(): Observable<{ accessToken: string; refreshToken?: string; }> {
		if (!this.refreshObservable) {
			console.log('[GATUNO_REFRESH_V2] Iniciando processo de refresh...');
			this.refreshObservable = timer(0, 500).pipe(
				take(3),
				map((i) => {
					const token = this.csrfToken?.trim();
					console.log(`[GATUNO_REFRESH_V2] Tentativa ${i + 1} de obter CSRF... ${token ? 'Sucesso' : 'Falha'}`);
					return token;
				}),
				filter((token): token is string => !!token),
				take(1),
				throwIfEmpty(() => new Error('CRITICAL: Token CSRF não encontrado após 3 tentativas')),
				switchMap((csrfToken) => {
					console.log('[GATUNO_REFRESH_V2] Disparando requisição POST /auth/refresh');
					return this.http.post<{ accessToken: string; refreshToken?: string; }>(
						'/auth/refresh',
						null,
						{
							withCredentials: true,
							headers: { 'x-csrf-token': csrfToken },
						},
					);
				}),
				tap((body) => {
					if (body?.accessToken) {
						console.log('[GATUNO_REFRESH_V2] Refresh concluído com sucesso!');
						this.setTokens(body.accessToken);
					} else {
						console.warn('[GATUNO_REFRESH_V2] Resposta de refresh vazia ou inválida');
					}
				}),
				finalize(() => {
					this.refreshObservable = null;
				}),
				shareReplay(1),
				catchError((err) => {
					if (err.message?.includes('Token CSRF não encontrado')) {
						console.error(
							'[GATUNO_REFRESH_V2] Erro fatal: CSRF ausente após retries',
						);
					} else {
						console.error('[GATUNO_REFRESH_V2] Erro na requisição de refresh:', err);
					}
					return throwError(() => err);
				}),
			) as Observable<{ accessToken: string; refreshToken?: string; }>;
		}
		return this.refreshObservable!;
	}

	private hasRole(role: Role): boolean {
		return this.rolesSignal().includes(role);
	}

	get isAdmin(): boolean {
		return this.isAdminSignal();
	}
}
