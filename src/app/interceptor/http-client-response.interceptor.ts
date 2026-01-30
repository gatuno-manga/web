import {
	HttpErrorResponse,
	HttpEvent,
	HttpHandlerFn,
	HttpInterceptorFn,
	HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { UserTokenService } from '../service/user-token.service';
import { AuthQueueService } from '../service/auth-queue.service';

export const httpClientResponseInterceptor: HttpInterceptorFn = (req, next) => {
	const userTokenService = inject(UserTokenService);
	const authQueue = inject(AuthQueueService);
	const excludedUrls = ['/auth/refresh', '/auth/signup', '/auth/login'];

	return next(req).pipe(
		catchError((error) => {
			if (
				error instanceof HttpErrorResponse &&
				error.status === 401 &&
				!excludedUrls.some((url) => req.url.includes(url))
			) {
				return handle401Error(req, next, userTokenService, authQueue);
			}

			return throwError(() => error);
		})
	);
};

const handle401Error = (
	req: HttpRequest<unknown>,
	next: HttpHandlerFn,
	tokenService: UserTokenService,
	authQueue: AuthQueueService
): Observable<HttpEvent<unknown>> => {

	if (!authQueue.isRefreshing) {
		authQueue.startRefreshing();

		return tokenService.refreshTokens().pipe(
			switchMap((tokens) => {
				tokenService.setTokens(tokens.accessToken, tokens.refreshToken);
				authQueue.notifySuccess(tokens.accessToken);

				return next(addToken(req, tokens.accessToken));
			}),
			catchError((err) => {
				tokenService.removeTokens();
				authQueue.notifyFailure(err);
				return throwError(() => err);
			})
		);
	} else {
		return authQueue.token$.pipe(
			filter((token): token is string => token !== null),
			take(1),
			switchMap((token) => {
				return next(addToken(req, token));
			})
		);
	}
};

const addToken = (req: HttpRequest<unknown>, token: string): HttpRequest<unknown> => {
	return req.clone({
		setHeaders: { Authorization: `Bearer ${token}` }
	});
};