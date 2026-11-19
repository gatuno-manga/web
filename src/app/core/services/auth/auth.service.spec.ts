import {
	HttpClientTestingModule,
	HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
	authTokensResponse,
	loginRequest,
	loginResponse,
	registerRequest,
} from '@models/user.models';
import { AuthenticationResponseJSON } from '@simplewebauthn/browser';
import { AuthService } from './auth.service';
import { CsrfService } from './csrf.service';
import { REFRESH_ERROR_CODES } from './refresh-error.util';
import { UserTokenService } from './user-token.service';

describe('AuthService', () => {
	let service: AuthService;
	let httpMock: HttpTestingController;
	let userTokenServiceSpy: jasmine.SpyObj<UserTokenService>;
	let csrfServiceSpy: jasmine.SpyObj<CsrfService>;
	let currentCsrfToken: string | null;

	const mockAssertion: AuthenticationResponseJSON = {
		id: 'cred',
		rawId: 'cred',
		response: {
			clientDataJSON: '',
			authenticatorData: '',
			signature: '',
			userHandle: '',
		},
		clientExtensionResults: {},
		type: 'public-key',
	};

	beforeEach(() => {
		currentCsrfToken = 'mock-csrf';
		const userTokenSpy = jasmine.createSpyObj(
			'UserTokenService',
			['setTokens', 'removeTokens'],
			{
				csrfToken: 'mock-csrf',
			},
		);
		csrfServiceSpy = jasmine.createSpyObj('CsrfService', ['setToken']);
		Object.defineProperty(csrfServiceSpy, 'csrfToken', {
			get: () => currentCsrfToken,
			configurable: true,
		});

		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
			providers: [
				AuthService,
				{ provide: UserTokenService, useValue: userTokenSpy },
				{ provide: CsrfService, useValue: csrfServiceSpy },
			],
		});

		service = TestBed.inject(AuthService);
		httpMock = TestBed.inject(HttpTestingController);
		userTokenServiceSpy = TestBed.inject(
			UserTokenService,
		) as jasmine.SpyObj<UserTokenService>;
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('login', () => {
		it('should call login endpoint and set tokens on success', () => {
			const mockReq: loginRequest = {
				email: 'test@example.com',
				password: 'password',
			};
			const mockRes: loginResponse = {
				accessToken: 'access',
				csrfToken: 'csrf',
			};

			service.login(mockReq).subscribe((response) => {
				expect(response.body).toEqual(mockRes);
				expect(userTokenServiceSpy.setTokens).toHaveBeenCalledWith(
					'access',
					'csrf',
				);
			});

			const req = httpMock.expectOne('/auth/signin');
			expect(req.request.method).toBe('POST');
			req.flush(mockRes);
		});
	});

	describe('verifyMfaLogin', () => {
		it('should call verify endpoint and set tokens on success', () => {
			const mockRes: authTokensResponse = {
				accessToken: 'access',
				csrfToken: 'csrf',
			};

			service
				.verifyMfaLogin('mfa-token', '123456')
				.subscribe((response) => {
					expect(response.body).toEqual(mockRes);
					expect(userTokenServiceSpy.setTokens).toHaveBeenCalledWith(
						'access',
						'csrf',
					);
				});

			const req = httpMock.expectOne('/auth/mfa/verify-login');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({
				mfaToken: 'mfa-token',
				code: '123456',
			});
			req.flush(mockRes);
		});
	});

	describe('logout', () => {
		it('should call logout endpoint and remove tokens', () => {
			service.logout().subscribe(() => {
				expect(userTokenServiceSpy.removeTokens).toHaveBeenCalledWith(
					false,
				);
			});

			const req = httpMock.expectOne('/auth/logout');
			expect(req.request.method).toBe('GET');
			expect(req.request.headers.get('x-csrf-token')).toBe('mock-csrf');
			req.flush({});
		});

		it('should re-read CSRF token and retry once on 403 CSRF_TOKEN_INVALID', () => {
			let completed = false;
			service.logout().subscribe({
				complete: () => {
					completed = true;
				},
			});

			const req1 = httpMock.expectOne('/auth/logout');
			expect(req1.request.headers.get('x-csrf-token')).toBe('mock-csrf');
			currentCsrfToken = 'fresh-csrf';
			req1.flush(
				{ code: REFRESH_ERROR_CODES.CSRF_TOKEN_INVALID },
				{ status: 403, statusText: 'Forbidden' },
			);

			const req2 = httpMock.expectOne('/auth/logout');
			expect(req2.request.headers.get('x-csrf-token')).toBe('fresh-csrf');
			req2.flush({});

			expect(completed).toBeTrue();
			expect(userTokenServiceSpy.removeTokens).toHaveBeenCalledWith(
				false,
			);
		});

		it('should still clear local tokens and complete cleanly when logout fails after retry or on network/5xx error', () => {
			let completed = false;
			service.logout().subscribe({
				error: () => fail('logout should not error'),
				complete: () => {
					completed = true;
				},
			});

			const req1 = httpMock.expectOne('/auth/logout');
			req1.flush(
				{ code: REFRESH_ERROR_CODES.CSRF_TOKEN_INVALID },
				{ status: 403, statusText: 'Forbidden' },
			);

			const req2 = httpMock.expectOne('/auth/logout');
			req2.flush(
				{ code: REFRESH_ERROR_CODES.CSRF_TOKEN_INVALID },
				{ status: 403, statusText: 'Forbidden' },
			);

			expect(completed).toBeTrue();
			expect(userTokenServiceSpy.removeTokens).toHaveBeenCalledWith(
				false,
			);

			userTokenServiceSpy.removeTokens.calls.reset();
			let networkCompleted = false;
			service.logout().subscribe({
				error: () => fail('logout should not error on 500'),
				complete: () => {
					networkCompleted = true;
				},
			});

			const req3 = httpMock.expectOne('/auth/logout');
			req3.flush('Server Error', {
				status: 500,
				statusText: 'Server Error',
			});

			expect(networkCompleted).toBeTrue();
			expect(userTokenServiceSpy.removeTokens).toHaveBeenCalledWith(
				false,
			);
		});
	});

	describe('register', () => {
		it('should call register endpoint and set tokens on success', () => {
			const mockReq: registerRequest = {
				email: 'new@example.com',
				password: 'password',
			};
			const mockRes: authTokensResponse = {
				accessToken: 'access',
				csrfToken: 'csrf',
			};

			service.register(mockReq).subscribe((response) => {
				expect(response.body).toEqual(mockRes);
				expect(userTokenServiceSpy.setTokens).toHaveBeenCalledWith(
					'access',
					'csrf',
				);
			});

			const req = httpMock.expectOne('/auth/signup');
			expect(req.request.method).toBe('POST');
			req.flush(mockRes);
		});
	});

	describe('passkeys', () => {
		it('beginPasskeyAuthentication should call options endpoint with email', () => {
			service.beginPasskeyAuthentication('test@example.com').subscribe();
			const req = httpMock.expectOne(
				'/auth/passkeys/authenticate/options',
			);
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({ email: 'test@example.com' });
			req.flush({});
		});

		it('beginPasskeyAuthentication should call options endpoint without email', () => {
			service.beginPasskeyAuthentication().subscribe();
			const req = httpMock.expectOne(
				'/auth/passkeys/authenticate/options',
			);
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({});
			req.flush({});
		});

		it('verifyPasskeyAuthentication should call verify endpoint and set tokens', () => {
			const mockRes: loginResponse = {
				accessToken: 'access',
				csrfToken: 'csrf',
			};

			service
				.verifyPasskeyAuthentication(mockAssertion, 'test@example.com')
				.subscribe((_response) => {
					expect(userTokenServiceSpy.setTokens).toHaveBeenCalledWith(
						'access',
						'csrf',
					);
				});

			const req = httpMock.expectOne(
				'/auth/passkeys/authenticate/verify',
			);
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({
				response: mockAssertion,
				email: 'test@example.com',
			});
			req.flush(mockRes);
		});
	});
});
