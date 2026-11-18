import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {
	getAuthErrorCode,
	isCsrfTokenInvalidError,
	isDeadSessionRefreshError,
	isRefreshInProgressError,
	parseRetryAfterSeconds,
	REFRESH_ERROR_CODES,
} from './refresh-error.util';

describe('refresh-error.util', () => {
	describe('getAuthErrorCode', () => {
		it('should extract string code from HttpErrorResponse body', () => {
			const err = new HttpErrorResponse({
				status: 409,
				error: { code: 'REFRESH_IN_PROGRESS' },
			});
			expect(getAuthErrorCode(err)).toBe('REFRESH_IN_PROGRESS');
		});

		it('should return null for non-HttpErrorResponse or missing code', () => {
			expect(getAuthErrorCode(new Error('boom'))).toBeNull();
			expect(
				getAuthErrorCode(
					new HttpErrorResponse({
						status: 500,
						error: 'Server error',
					}),
				),
			).toBeNull();
		});
	});

	describe('isDeadSessionRefreshError', () => {
		it('should return true for 401 across all refresh error codes', () => {
			const codes = [
				REFRESH_ERROR_CODES.REFRESH_TOKEN_MISSING,
				REFRESH_ERROR_CODES.REFRESH_TOKEN_INVALID,
				REFRESH_ERROR_CODES.REFRESH_SESSION_NOT_FOUND,
				REFRESH_ERROR_CODES.REFRESH_TOKEN_REUSED,
				REFRESH_ERROR_CODES.REFRESH_USER_NOT_FOUND,
			];
			for (const code of codes) {
				const err = new HttpErrorResponse({
					status: 401,
					error: { code },
				});
				expect(isDeadSessionRefreshError(err)).toBeTrue();
			}
		});

		it('should return false for 403, 409, 500, and 0', () => {
			for (const status of [403, 409, 500, 0]) {
				expect(
					isDeadSessionRefreshError(
						new HttpErrorResponse({ status }),
					),
				).toBeFalse();
			}
		});
	});

	describe('isRefreshInProgressError', () => {
		it('should return true only for 409 with REFRESH_IN_PROGRESS code', () => {
			expect(
				isRefreshInProgressError(
					new HttpErrorResponse({
						status: 409,
						error: {
							code: REFRESH_ERROR_CODES.REFRESH_IN_PROGRESS,
						},
					}),
				),
			).toBeTrue();

			expect(
				isRefreshInProgressError(
					new HttpErrorResponse({
						status: 409,
						error: { code: 'OTHER_CONFLICT' },
					}),
				),
			).toBeFalse();
		});
	});

	describe('isCsrfTokenInvalidError', () => {
		it('should return true only for 403 with CSRF_TOKEN_INVALID code', () => {
			expect(
				isCsrfTokenInvalidError(
					new HttpErrorResponse({
						status: 403,
						error: { code: REFRESH_ERROR_CODES.CSRF_TOKEN_INVALID },
					}),
				),
			).toBeTrue();

			expect(
				isCsrfTokenInvalidError(
					new HttpErrorResponse({
						status: 403,
						error: { code: 'FORBIDDEN' },
					}),
				),
			).toBeFalse();
		});
	});

	describe('parseRetryAfterSeconds', () => {
		it('should parse integer seconds and clamp to [0, 5]', () => {
			const makeErr = (header?: string) =>
				new HttpErrorResponse({
					status: 409,
					headers: header
						? new HttpHeaders({ 'Retry-After': header })
						: new HttpHeaders(),
				});

			expect(parseRetryAfterSeconds(makeErr())).toBe(1);
			expect(parseRetryAfterSeconds(makeErr('0'))).toBe(0);
			expect(parseRetryAfterSeconds(makeErr('3'))).toBe(3);
			expect(parseRetryAfterSeconds(makeErr('12'))).toBe(5);
			expect(parseRetryAfterSeconds(makeErr('-2'))).toBe(1);
			expect(parseRetryAfterSeconds(makeErr('invalid'))).toBe(1);
		});
	});
});
