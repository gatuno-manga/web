import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import {
	isDeadSessionRefreshError,
	SESSION_EXPIRED_MESSAGE,
} from '@core/services/auth/refresh-error.util';
import { UserTokenService } from '@core/services/auth/user-token.service';
import { NotificationService } from '@core/services/notification/notification.service';
import { catchError, map, Observable, of } from 'rxjs';

function tryRefreshOrRedirect(
	tokenService: UserTokenService,
	notificationService: NotificationService,
	router: Router,
	returnUrl?: string,
): Observable<boolean | UrlTree> | UrlTree | boolean {
	if (tokenService.hasValidAccessToken) {
		return true;
	}

	if (tokenService.hasValidRefreshToken) {
		return tokenService.refreshTokens().pipe(
			map(() => true),
			catchError((err) => {
				if (isDeadSessionRefreshError(err)) {
					tokenService.removeTokens(false);
					notificationService.show(
						SESSION_EXPIRED_MESSAGE,
						'warning',
					);
					return of(
						router.createUrlTree(['/auth/login'], {
							queryParams:
								returnUrl !== undefined
									? { sessionExpired: 'true', returnUrl }
									: { sessionExpired: 'true' },
						}),
					);
				}
				return of(true);
			}),
		);
	}

	return router.createUrlTree(['/auth/login'], {
		queryParams: returnUrl !== undefined ? { returnUrl } : undefined,
	});
}

export const isLoggedGuard: CanActivateFn = (_route, state) =>
	tryRefreshOrRedirect(
		inject(UserTokenService),
		inject(NotificationService),
		inject(Router),
		state.url,
	);

export const isNotLoggedGuard: CanActivateFn = () => {
	const tokenService = inject(UserTokenService);
	const router = inject(Router);

	if (tokenService.hasValidAccessToken) {
		return router.createUrlTree(['']);
	}

	return true;
};

export const isLoggedMatchGuard: CanMatchFn = (_route, _segments) =>
	tryRefreshOrRedirect(
		inject(UserTokenService),
		inject(NotificationService),
		inject(Router),
	);

export const isNotLoggedMatchGuard: CanMatchFn = () => {
	const tokenService = inject(UserTokenService);
	const router = inject(Router);

	if (tokenService.hasValidAccessToken) {
		return router.createUrlTree(['']);
	}

	return true;
};
