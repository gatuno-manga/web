import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { UserTokenService } from '../service/user-token.service';
import { buildApiUrl } from '../utils/api-url.utils';

export const HttpClientRequestInterceptor: HttpInterceptorFn = (req, next) => {
  const userTokenService = inject(UserTokenService);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  const requestUrl = buildApiUrl(req.url, {
    isBrowser,
    apiUrl: environment.apiURL,
    apiUrlServer: environment.apiURLServer,
    origin: isBrowser ? window.location.origin : undefined
  });

  const authHeader = userTokenService.authHeaderSignal();
  let headers = req.headers;

  if (authHeader) {
    headers = headers.set('Authorization', authHeader);

    if (!isBrowser) {
      // SSR: forward both access and refresh token cookies to the API
      const cookieParts: string[] = [];
      const accessToken = userTokenService.accessTokenSignal();
      const refreshToken = userTokenService.refreshToken;
      if (accessToken) cookieParts.push(`accessToken=${accessToken}`);
      if (refreshToken) cookieParts.push(`refreshToken=${refreshToken}`);
      if (cookieParts.length > 0) {
        headers = headers.set('cookie', cookieParts.join('; '));
      }
    }
  }

  const clonedRequest = req.clone({
    url: requestUrl,
    headers: headers
  });

  return next(clonedRequest);
};
