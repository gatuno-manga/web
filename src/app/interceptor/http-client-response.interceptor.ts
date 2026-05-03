import {
	HttpErrorResponse,
	HttpEvent,
	HttpHandlerFn,
	HttpInterceptorFn,
	HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
	Observable,
	catchError,
	filter,
	switchMap,
	take,
	throwError,
} from 'rxjs';
import { UserTokenService } from '../service/user-token.service';
import { AuthQueueService } from '../service/auth-queue.service';

export const httpClientResponseInterceptor: HttpInterceptorFn = (req, next) => {
	const userTokenService = inject(UserTokenService);
	const authQueue = inject(AuthQueueService);
	const excludedUrls = ['/auth/refresh', '/auth/signup', '/auth/signin'];

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
		}),
	);
};

const handle401Error = (
	req: HttpRequest<unknown>,
	next: HttpHandlerFn,
	tokenService: UserTokenService,
	authQueue: AuthQueueService,
): Observable<HttpEvent<unknown>> => {
	if (!authQueue.isRefreshing) {
		console.log('[GATUNO_INTERCEPTOR] Iniciando processo de refresh devido a 401...');
		authQueue.startRefreshing();

		return tokenService.refreshTokens().pipe(
			catchError((err) => {
				console.error('[GATUNO_INTERCEPTOR] Erro no refreshTokens:', err);
				tokenService.removeTokens(true);
				authQueue.notifyFailure(err);
				return throwError(() => err);
			}),
			switchMap((tokens) => {
				if (!tokens || !tokens.accessToken) {
					console.error(
						'[GATUNO_INTERCEPTOR] Token de acesso ausente na resposta de refresh. Encerrando sessão.',
					);
					const err = new Error('Missing accessToken in refresh response');
					tokenService.removeTokens(true);
					authQueue.notifyFailure(err);
					return throwError(() => err);
				}
				console.log(
					'[GATUNO_INTERCEPTOR] Refresh concluído, repetindo requisição original...',
				);
				authQueue.notifySuccess(tokens.accessToken);
				return next(addToken(req, tokens.accessToken));
			}),
		);
	}

	console.log('[GATUNO_INTERCEPTOR] Requisição enfileirada aguardando refresh...');
	return authQueue.token$.pipe(
		filter((token): token is string => token !== null || authQueue.hasFailed),
		take(1),
		switchMap((token) => {
			if (authQueue.hasFailed) {
				return throwError(() => new Error('Falha na renovação do token (fila)'));
			}
			console.log('[GATUNO_INTERCEPTOR] Retentando requisição enfileirada...');
			return next(addToken(req, token as string));
		}),
	);
};

const addToken = (
	req: HttpRequest<unknown>,
	token: string,
): HttpRequest<unknown> => {
	return req.clone({
		setHeaders: { Authorization: `Bearer ${token}` },
	});
};
