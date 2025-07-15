import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { UserTokenService } from '../service/user-token.service';

export const HttpClientRequestInterceptor: HttpInterceptorFn = (req, next) => {
  const userTokenService = inject(UserTokenService);
  const token = userTokenService.AccessToken;

  let clonedRequest = req;
  if (!/^https?:\/\//i.test(req.url) && !req.url.startsWith('/assets/') && !req.url.startsWith('/favicon.ico')) {
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
    clonedRequest = req.clone({
      url,
      setHeaders: {
        Authorization: `Bearer ${token}`,
        cookie: `accessToken=${token}`,
      },
    });
  }

  return next(clonedRequest);
};
