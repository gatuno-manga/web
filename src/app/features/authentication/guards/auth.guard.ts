import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { UserTokenService } from '@core/services/user-token.service';
import { catchError, map, of } from 'rxjs';

export const isLoggedGuard: CanActivateFn = (_route, state) => {
	const tokenService = inject(UserTokenService);
	const router = inject(Router);

	if (tokenService.hasValidAccessToken) {
		return true;
	}

	if (tokenService.hasValidRefreshToken) {
		return tokenService.refreshTokens().pipe(
			map(() => true),
			catchError(() => {
				const returnUrl = state.url;
				return of(
					router.createUrlTree(['/auth/login'], {
						queryParams: { returnUrl },
					}),
				);
			}),
		);
	}

	const returnUrl = state.url;
	return router.createUrlTree(['/auth/login'], {
		queryParams: { returnUrl },
	});
};

export const isNotLoggedGuard: CanActivateFn = () => {
	const tokenService = inject(UserTokenService);
	const router = inject(Router);

	if (tokenService.hasValidAccessToken) {
		return router.createUrlTree(['']);
	}

	return true;
};

export const isLoggedMatchGuard: CanMatchFn = (_route, _segments) => {
	const tokenService = inject(UserTokenService);
	const router = inject(Router);

	if (tokenService.hasValidAccessToken) {
		return true;
	}

	if (tokenService.hasValidRefreshToken) {
		return tokenService.refreshTokens().pipe(
			map(() => true),
			catchError(() => of(router.createUrlTree(['/auth/login']))),
		);
	}

	return router.createUrlTree(['/auth/login']);
};

export const isNotLoggedMatchGuard: CanMatchFn = () => {
	const tokenService = inject(UserTokenService);
	const router = inject(Router);

	if (tokenService.hasValidAccessToken) {
		return router.createUrlTree(['']);
	}

	return true;
};
