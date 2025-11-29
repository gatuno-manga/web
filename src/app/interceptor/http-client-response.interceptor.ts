import {
	HttpErrorResponse,
	HttpEvent,
	HttpHandlerFn,
	HttpInterceptorFn,
	HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { UserTokenService } from '../service/user-token.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const httpClientResponseInterceptor: HttpInterceptorFn = (req, next) => {
	const userTokenService = inject(UserTokenService);
	const excludedUrls = ['/auth/refresh', '/auth/signup', '/auth/login'];

	return next(req).pipe(
		catchError((error) => {
			if (
				error instanceof HttpErrorResponse &&
				error.status === 401 &&
				!excludedUrls.some((url) => req.url.includes(url))
			) {
				return handle401Error(req, next, userTokenService);
			}

			return throwError(() => error);
		})
	);
};

const handle401Error = (
	req: HttpRequest<unknown>,
	next: HttpHandlerFn,
	tokenService: UserTokenService
): Observable<HttpEvent<unknown>> => {

	if (!isRefreshing) {
		isRefreshing = true;
		refreshTokenSubject.next(null);

		return tokenService.refreshTokens().pipe(
			switchMap((tokens) => {
				isRefreshing = false;
				tokenService.setTokens(tokens.accessToken, tokens.refreshToken);
				refreshTokenSubject.next(tokens.accessToken);

				return next(addToken(req, tokens.accessToken));
			}),
			catchError((err) => {
				isRefreshing = false;
				tokenService.removeTokens();
				return throwError(() => err);
			})
		);
	} else {
		return refreshTokenSubject.pipe(
			filter((token): token is string => token !== null),
			take(1),
			switchMap((token) => {
				return next(addToken(req, token));
			})
		);
	}
};

// CORREÇÃO AQUI: Tipagem explícita do helper
const addToken = (req: HttpRequest<unknown>, token: string): HttpRequest<unknown> => {
	return req.clone({
		setHeaders: { Authorization: `Bearer ${token}` }
	});
};
