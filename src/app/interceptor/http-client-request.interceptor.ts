import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { UserTokenService } from '../service/user-token.service';
import { switchMap, catchError } from 'rxjs';
import { of } from 'rxjs';

export const HttpClientRequestInterceptor: HttpInterceptorFn = (req, next) => {
  const userTokenService = inject(UserTokenService);
  const requestExclude = ['/favicon.ico', '/data/', '/assets/'];

  let clonedRequest = req;
  if (!/^https?:\/\//i.test(req.url) && !requestExclude.some(url => req.url.includes(url))) {
    let baseUrl = environment.apiURL;

    if (!baseUrl) {
      const platformId = inject(PLATFORM_ID);
      if (isPlatformBrowser(platformId)) {
        baseUrl = window.location.origin + '/api';
      } else {
        baseUrl = '/api';
      }
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/${req.url.replace(/^\/+/, '')}`;

    const excludeRefresh = ['/auth/refresh', '/auth/signup'];
    if (!userTokenService.hasToken && userTokenService.hasValidRefreshToken && !excludeRefresh.some(url => req.url.includes(url))) {
      return userTokenService.refreshTokens().pipe(
        switchMap(({ accessToken, refreshToken }) => {
          userTokenService.setTokens(accessToken, refreshToken);
          const updatedToken = accessToken;
          const updatedRequest = req.clone({
            url,
            setHeaders: {
              Authorization: `Bearer ${updatedToken}`,
              cookie: `accessToken=${updatedToken}`,
            },
          });
          return next(updatedRequest);
        }),
        catchError((error) => {
          console.error('Erro ao renovar tokens:', error);
          userTokenService.removeTokens();
          const requestWithoutAuth = req.clone({ url });
          return next(requestWithoutAuth);
        })
      );
    }

    const token = userTokenService.accessToken;
    const headers: { [key: string]: string } = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['cookie'] = `accessToken=${token}`;
    }

    clonedRequest = req.clone({
      url,
      setHeaders: headers,
    });
  }

  return next(clonedRequest);
};
