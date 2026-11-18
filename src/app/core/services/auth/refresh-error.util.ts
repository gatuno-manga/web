import { HttpErrorResponse } from '@angular/common/http';

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

/**
 * Parses integer Retry-After seconds, falling back to defaultSeconds on missing/NaN/negative
 * and clamping to [minSeconds, maxSeconds] (default [0, 5]).
 */
export function parseRetryAfterSeconds(
	error: HttpErrorResponse,
	defaultSeconds = 1,
	minSeconds = 0,
	maxSeconds = 5,
): number {
	const raw = error.headers?.get('Retry-After');
	if (!raw?.trim()) {
		return defaultSeconds;
	}

	const parsed = Number.parseInt(raw.trim(), 10);
	if (Number.isNaN(parsed) || parsed < 0) {
		return defaultSeconds;
	}

	return Math.min(maxSeconds, Math.max(minSeconds, parsed));
}
