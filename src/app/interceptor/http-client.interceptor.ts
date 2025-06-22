import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { inject } from '@angular/core';

export const HttpClientInterceptor: HttpInterceptorFn = (req, next) => {
  let clonedRequest = req;

  if (!req.url.includes('https://')) {
    const url = (environment.apiURL ?? `${window.location.origin}/api`) + `/${req.url}`;

    clonedRequest = req.clone({
      url,
    });
  }

  return next(clonedRequest);
};
