import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const HttpClientInterceptor: HttpInterceptorFn = (req, next) => {
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
    clonedRequest = req.clone({ url });
  }

  return next(clonedRequest);
};
