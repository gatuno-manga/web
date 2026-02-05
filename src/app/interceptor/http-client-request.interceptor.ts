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
      const token = userTokenService.accessTokenSignal();
      if (token) {
        headers = headers.set('cookie', `accessToken=${token}`);
      }
    }
  }

  const clonedRequest = req.clone({
    url: requestUrl,
    headers: headers
  });

  return next(clonedRequest);
};
