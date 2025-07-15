import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { UserTokenService } from '../service/user-token.service';

export const httpClientResponseInterceptor: HttpInterceptorFn = (req, next) => {
  const userTokenService = inject(UserTokenService);
  const token = userTokenService.AccessToken;

  let clonedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(clonedRequest).pipe(
    catchError((error) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh') && userTokenService.hasToken) {
        return userTokenService.refreshTokens().pipe(
          switchMap((newToken) => {
            userTokenService.setTokens(newToken.accessToken, newToken.refreshToken);
            const retryRequest = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`,
              },
            });
            return next(retryRequest);
          }),
          catchError(() => throwError(() => error))
        );
      }
      return throwError(() => error);
    })
  );
};
