import { Injectable, OnDestroy, PLATFORM_ID, inject, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { UserTokenService } from './user-token.service';
import { interval, Subscription } from 'rxjs';
import { switchMap, filter, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { NotificationService } from './notification.service';

@Injectable({
    providedIn: 'root'
})
export class TokenRefreshTimerService implements OnDestroy {
    private refreshSubscription?: Subscription;
    private readonly CHECK_INTERVAL = 60000;
    private readonly REFRESH_THRESHOLD = 300;
    private platformId = inject(PLATFORM_ID);
    private ngZone = inject(NgZone);
    private router = inject(Router);
    private notificationService = inject(NotificationService);
    private isBrowser: boolean;

    constructor(private userTokenService: UserTokenService) {
        this.isBrowser = isPlatformBrowser(this.platformId);

        if (this.isBrowser) {
            setTimeout(() => {
                if (this.userTokenService.hasToken) {
                    this.startAutoRefresh();
                }
            }, 1000);
        }
    }

    startAutoRefresh(): void {
        if (!this.isBrowser) {
            return;
        }

        if (this.refreshSubscription && !this.refreshSubscription.closed) {
            return;
        }

        this.ngZone.runOutsideAngular(() => {
            this.refreshSubscription = interval(this.CHECK_INTERVAL)
                .pipe(
                    filter(() => {
                        if (!this.userTokenService.hasToken) {
                            return false;
                        }

                        if (!this.userTokenService.hasValidRefreshToken) {
                            this.handleTokenExpiration();
                            return false;
                        }

                        const expirationTime = this.userTokenService.timeToExpire;
                        const currentTime = Math.floor(Date.now() / 1000);
                        const timeUntilExpiration = expirationTime - currentTime;

                        if (timeUntilExpiration <= 0) {
                            return false;
                        }

                        if (timeUntilExpiration <= this.REFRESH_THRESHOLD && timeUntilExpiration > 0) {
                            return true;
                        }

                        return false;
                    }),
                    switchMap(() => {
                        return this.ngZone.run(() =>
                            this.userTokenService.refreshTokens().pipe(
                                catchError((error) => {
                                    if (error.status === 401) {
                                        this.handleTokenExpiration();
                                    }

                                    return of(null);
                                })
                            )
                        );
                    }),
                    filter(result => result !== null)
                )
                .subscribe({
                    next: () => {},
                    error: () => {
                        this.stopAutoRefresh();
                    }
                });
        });
    }

    private handleTokenExpiration(): void {
        this.stopAutoRefresh();
        this.userTokenService.removeTokens();

        this.notificationService.show(
            'Sua sessão expirou por inatividade. Por favor, faça login novamente.',
            'warning'
        );

        this.ngZone.run(() => {
            this.router.navigate(['/auth/login'], {
                queryParams: { sessionExpired: 'true' }
            });
        });
    }
    stopAutoRefresh(): void {
        if (this.refreshSubscription) {
            this.refreshSubscription.unsubscribe();
            this.refreshSubscription = undefined;
        }
    }

    isActive(): boolean {
        return !!this.refreshSubscription && !this.refreshSubscription.closed;
    }

    ngOnDestroy(): void {
        this.stopAutoRefresh();
    }
}
