import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '@core/services/user.service';
import { UserTokenService } from '@core/services/user-token.service';
import { map } from 'rxjs';

export const permissionGuard = (permissions: string | string[]): CanActivateFn => {
	return () => {
		const userService = inject(UserService);
		const userTokenService = inject(UserTokenService);
		const router = inject(Router);

		// Sem token válido = bloqueado imediato
		if (!userTokenService.hasValidAccessTokenSignal()) {
			return router.parseUrl('/auth/login');
		}

		const check = () => {
			if (userService.hasPermission(permissions)) {
				return true;
			}
			return router.parseUrl('/home');
		};

		// Se o perfil já estiver em cache
		if (userService.profileSignal()) {
			return check();
		}

		// Se não estiver em cache, aguarda o fetchMe finalizar
		return userService.fetchMe().pipe(
			map(() => check())
		);
	};
};
