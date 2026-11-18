import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const SESSION_EXPIRED_MESSAGE =
	'Sua sessão expirou por inatividade. Por favor, faça login novamente.';

export const REFRESH_ERROR_CODES = {
	REFRESH_TOKEN_MISSING: 'REFRESH_TOKEN_MISSING',
	REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
	REFRESH_SESSION_NOT_FOUND: 'REFRESH_SESSION_NOT_FOUND',
	REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
	REFRESH_USER_NOT_FOUND: 'REFRESH_USER_NOT_FOUND',
	REFRESH_IN_PROGRESS: 'REFRESH_IN_PROGRESS',
	CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
} as const;

export function getAuthErrorCode(error: unknown): string | null {
	if (!(error instanceof HttpErrorResponse)) {
		return null;
	}
	const body = error.error;
	if (body && typeof body === 'object' && 'code' in body) {
		const code = (body as { code?: unknown }).code;
		return typeof code === 'string' ? code : null;
	}
	return null;
}

/**
 * Only a 401 from POST /auth/refresh indicates a dead session.
 */
export function isDeadSessionRefreshError(error: unknown): boolean {
	return error instanceof HttpErrorResponse && error.status === 401;
}

export function isRefreshInProgressError(error: unknown): boolean {
	return (
		error instanceof HttpErrorResponse &&
		error.status === 409 &&
		getAuthErrorCode(error) === REFRESH_ERROR_CODES.REFRESH_IN_PROGRESS
	);
}

export function isCsrfTokenInvalidError(error: unknown): boolean {
	return (
		error instanceof HttpErrorResponse &&
		error.status === 403 &&
		getAuthErrorCode(error) === REFRESH_ERROR_CODES.CSRF_TOKEN_INVALID
	);
}

export function retryOnInvalidCsrf<T>(
	requestFn: () => Observable<T>,
	canRetry: () => boolean = () => true,
): Observable<T> {
	return requestFn().pipe(
		catchError((err) => {
			if (isCsrfTokenInvalidError(err) && canRetry()) {
				return requestFn();
			}
			return throwError(() => err);
		}),
	);
}

/**
 * Parses integer Retry-After seconds, falling back to 1 on missing/NaN/negative
 * and clamping to [0, 5].
 */
export function parseRetryAfterSeconds(error: HttpErrorResponse): number {
	const raw = error.headers?.get('Retry-After');
	if (!raw?.trim()) {
		return 1;
	}

	const parsed = Number.parseInt(raw.trim(), 10);
	if (Number.isNaN(parsed) || parsed < 0) {
		return 1;
	}

	return Math.min(5, Math.max(0, parsed));
}
