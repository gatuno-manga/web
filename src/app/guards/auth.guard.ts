import { inject } from "@angular/core";
import { CanActivateFn, CanMatchFn, Router, UrlTree } from "@angular/router";
import { UserTokenService } from "../service/user-token.service";
import { Observable, of, catchError, map } from "rxjs";

export const isLoggedGuard: CanActivateFn = (route, state) => {
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
        return of(router.createUrlTree(['/login'], {
          queryParams: { returnUrl }
        }));
      })
    );
  }

  const returnUrl = state.url;
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl }
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

export const isLoggedMatchGuard: CanMatchFn = (route, segments) => {
  const tokenService = inject(UserTokenService);
  const router = inject(Router);

  if (tokenService.hasValidAccessToken) {
    return true;
  }

  if (tokenService.hasValidRefreshToken) {
    return tokenService.refreshTokens().pipe(
      map(() => true),
      catchError(() => of(router.createUrlTree(['/login'])))
    );
  }

  return router.createUrlTree(['/login']);
};

export const isNotLoggedMatchGuard: CanMatchFn = () => {
  const tokenService = inject(UserTokenService);
  const router = inject(Router);

  if (tokenService.hasValidAccessToken) {
    return router.createUrlTree(['']);
  }

  return true;
};
