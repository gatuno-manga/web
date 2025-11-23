import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { UserTokenService } from '../service/user-token.service';

export const HttpClientRequestInterceptor: HttpInterceptorFn = (req, next) => {
  const userTokenService = inject(UserTokenService);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  let requestUrl = req.url;
  const isAbsoluteUrl = /^https?:\/\//i.test(req.url);
  const requestExclude = ['/assets/', '/data/'];

  if (!isAbsoluteUrl && !requestExclude.some(path => req.url.includes(path))) {
    let baseUrl = environment.apiURL;

    if (!isBrowser) {
      baseUrl = environment.apiURLServer || environment.apiURL || 'http://localhost:3000/api';
    } else if (!baseUrl) {
      baseUrl = window.location.origin + '/api';
    }

    requestUrl = `${baseUrl.replace(/\/+$/, '')}/${req.url.replace(/^\/+/, '')}`;
  }

  const token = userTokenService.accessToken;
  let headers = req.headers;

  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);

    if (!isBrowser) {
      headers = headers.set('cookie', `accessToken=${token}`);
    }
  }

  const clonedRequest = req.clone({
    url: requestUrl,
    headers: headers
  });

  return next(clonedRequest);
};
