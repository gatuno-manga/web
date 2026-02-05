import { Injectable, inject, PLATFORM_ID, NgZone, signal, computed, DestroyRef } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CookieService } from "./cookie.service";
import { HttpClient } from "@angular/common/http";
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { payloadToken, Role } from "../models/user.models";
import { Observable, Subscription, timer } from 'rxjs';
import { shareReplay, tap, finalize } from 'rxjs/operators';
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
    private readonly REFRESHKEY = 'refreshToken';
    private readonly REFRESH_MARGIN_SEC = 60;

    private refreshObservable: Observable<{ accessToken: string, refreshToken: string }> | null = null;
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

        if (this.hasValidAccessToken) {
            this.scheduleAutoRefresh();
        }
    }

    private initCrossTabSync(): void {
        this.crossTabSync.messages$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((message: AuthSyncMessage) => {
                if (message.type === 'TOKEN_UPDATE') {
                    this._accessToken.set(message.accessToken ?? null);
                    if (message.accessToken) {
                        this.scheduleAutoRefresh();
                    }
                } else if (message.type === 'TOKEN_REMOVE') {
                    this.stopAutoRefresh();
                    this._accessToken.set(null);
                }
            });
    }

    setTokens(accessToken: string, refreshToken: string) {
        this.cookieService.set(this.ACCESSKEY, accessToken, false);
        this.cookieService.set(this.REFRESHKEY, refreshToken, false);
        this._accessToken.set(accessToken);
        this.scheduleAutoRefresh();
        this.crossTabSync.notifyTokenUpdate(accessToken);
    }

    removeTokens(notifyUser = false): void {
        this.stopAutoRefresh();
        this.cookieService.delete(this.ACCESSKEY, false);
        this.cookieService.delete(this.REFRESHKEY, false);
        this._accessToken.set(null);
        this.crossTabSync.notifyTokenRemove();

        if (notifyUser) {
            this.handleSessionExpired();
        }
    }

    private handleSessionExpired() {
        this.ngZone.run(() => {
            this.notificationService.show(
                'Sua sessão expirou por inatividade. Por favor, faça login novamente.',
                'warning'
            );
            this.router.navigate(['/auth/login'], {
                queryParams: { sessionExpired: 'true' }
            });
        });
    }

    get accessToken(): string | null {
        return this._accessToken();
    }

    get refreshToken(): string | null {
        return this.cookieService.get(this.REFRESHKEY, false);
    }

    get hasValidAccessToken(): boolean {
        return this.hasValidAccessTokenSignal();
    }

    get hasValidRefreshToken(): boolean {
        const token = this.refreshToken;
        return !!token && this.isTokenValid(token);
    }

    private isTokenValid(token: string): boolean {
        try {
            const { exp } = jwtDecode<payloadToken>(token);
            if (!exp) return false;
            return exp > Math.floor(Date.now() / 1000);
        } catch { return false; }
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
                this.ngZone.runOutsideAngular(() => {
                    this.refreshSubscription = timer(timeToRefresh).subscribe(() => {
                        this.ngZone.run(() => {
                            this.refreshTokens().subscribe({
                                error: () => {
                                    console.warn('Auto-refresh falhou. Encerrando sessão.');
                                    this.removeTokens(true);
                                }
                            });
                        });
                    });
                });
            } else {
                if (this.isTokenValid(this.accessToken)) {
                    this.refreshTokens().subscribe({
                        error: () => this.removeTokens(true)
                    });
                } else {
                    this.removeTokens(true);
                }
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

    refreshTokens() {
        if (!this.refreshObservable) {
            this.refreshObservable = this.http.get<{ accessToken: string, refreshToken: string }>('/auth/refresh', { withCredentials: true })
                .pipe(
                    tap(({ accessToken, refreshToken }) => {
                        this.setTokens(accessToken, refreshToken);
                    }),
                    shareReplay(1),
                    finalize(() => {
                        this.refreshObservable = null;
                    })
                );
        }
        return this.refreshObservable;
    }

    private hasRole(role: Role): boolean {
        return this.rolesSignal().includes(role);
    }

    get isAdmin(): boolean {
        return this.isAdminSignal();
    }
}
