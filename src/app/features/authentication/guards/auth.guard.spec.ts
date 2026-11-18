import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
	ActivatedRouteSnapshot,
	provideRouter,
	Router,
	RouterStateSnapshot,
	UrlTree,
} from '@angular/router';
import { REFRESH_ERROR_CODES } from '@core/services/auth/refresh-error.util';
import { UserTokenService } from '@core/services/auth/user-token.service';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { isLoggedGuard, isLoggedMatchGuard } from './auth.guard';

describe('AuthGuards', () => {
	let tokenServiceSpy: jasmine.SpyObj<UserTokenService>;
	let router: Router;
	let hasValidAccessToken = false;
	let hasValidRefreshToken = false;

	beforeEach(() => {
		hasValidAccessToken = false;
		hasValidRefreshToken = false;
		tokenServiceSpy = jasmine.createSpyObj('UserTokenService', [
			'refreshTokens',
			'removeTokens',
		]);
		Object.defineProperty(tokenServiceSpy, 'hasValidAccessToken', {
			get: () => hasValidAccessToken,
			configurable: true,
		});
		Object.defineProperty(tokenServiceSpy, 'hasValidRefreshToken', {
			get: () => hasValidRefreshToken,
			configurable: true,
		});

		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: UserTokenService, useValue: tokenServiceSpy },
			],
		});

		router = TestBed.inject(Router);
	});

	it('isLoggedGuard should allow navigation when access token is valid', () => {
		hasValidAccessToken = true;
		const result = TestBed.runInInjectionContext(() =>
			isLoggedGuard(
				{} as ActivatedRouteSnapshot,
				{ url: '/library' } as RouterStateSnapshot,
			),
		);
		expect(result).toBeTrue();
	});

	it('isLoggedGuard should sign out and redirect to /auth/login on 401 refresh failure', async () => {
		hasValidRefreshToken = true;
		tokenServiceSpy.refreshTokens.and.returnValue(
			throwError(
				() =>
					new HttpErrorResponse({
						status: 401,
						error: {
							code: REFRESH_ERROR_CODES.REFRESH_TOKEN_INVALID,
						},
					}),
			),
		);

		const resultOrObs = TestBed.runInInjectionContext(() =>
			isLoggedGuard(
				{} as ActivatedRouteSnapshot,
				{ url: '/library' } as RouterStateSnapshot,
			),
		);
		const result = isObservable(resultOrObs)
			? await firstValueFrom(resultOrObs)
			: resultOrObs;

		expect(tokenServiceSpy.removeTokens).toHaveBeenCalledWith(true);
		expect(result instanceof UrlTree).toBeTrue();
		expect(router.serializeUrl(result as UrlTree)).toBe(
			'/auth/login?returnUrl=%2Flibrary',
		);
	});

	it('isLoggedGuard should keep session and allow navigation on non-401 refresh failure (403/409/0/500)', async () => {
		hasValidRefreshToken = true;
		const non401Errors = [
			new HttpErrorResponse({
				status: 403,
				error: { code: REFRESH_ERROR_CODES.CSRF_TOKEN_INVALID },
			}),
			new HttpErrorResponse({
				status: 409,
				error: { code: REFRESH_ERROR_CODES.REFRESH_IN_PROGRESS },
			}),
			new HttpErrorResponse({ status: 0 }),
			new HttpErrorResponse({ status: 500 }),
		];

		for (const err of non401Errors) {
			tokenServiceSpy.removeTokens.calls.reset();
			tokenServiceSpy.refreshTokens.and.returnValue(
				throwError(() => err),
			);

			const resultOrObs = TestBed.runInInjectionContext(() =>
				isLoggedGuard(
					{} as ActivatedRouteSnapshot,
					{ url: '/library' } as RouterStateSnapshot,
				),
			);
			const result = isObservable(resultOrObs)
				? await firstValueFrom(resultOrObs)
				: resultOrObs;

			expect(tokenServiceSpy.removeTokens).not.toHaveBeenCalled();
			expect(result).toBeTrue();
		}
	});

	it('isLoggedMatchGuard should sign out on 401 and allow navigation on non-401 refresh error', async () => {
		hasValidRefreshToken = true;

		tokenServiceSpy.refreshTokens.and.returnValue(
			throwError(() => new HttpErrorResponse({ status: 401 })),
		);
		const obs401 = TestBed.runInInjectionContext(() =>
			isLoggedMatchGuard({} as never, [], {} as never),
		);
		const res401 = isObservable(obs401)
			? await firstValueFrom(obs401)
			: obs401;
		expect(tokenServiceSpy.removeTokens).toHaveBeenCalledWith(true);
		expect(res401 instanceof UrlTree).toBeTrue();

		tokenServiceSpy.removeTokens.calls.reset();
		tokenServiceSpy.refreshTokens.and.returnValue(
			throwError(() => new HttpErrorResponse({ status: 503 })),
		);
		const obs503 = TestBed.runInInjectionContext(() =>
			isLoggedMatchGuard({} as never, [], {} as never),
		);
		const res503 = isObservable(obs503)
			? await firstValueFrom(obs503)
			: obs503;
		expect(tokenServiceSpy.removeTokens).not.toHaveBeenCalled();
		expect(res503).toBeTrue();

		tokenServiceSpy.refreshTokens.and.returnValue(
			of({ accessToken: 'ok' }),
		);
		const obsOk = TestBed.runInInjectionContext(() =>
			isLoggedMatchGuard({} as never, [], {} as never),
		);
		const resOk = isObservable(obsOk) ? await firstValueFrom(obsOk) : obsOk;
		expect(resOk).toBeTrue();
	});
});
