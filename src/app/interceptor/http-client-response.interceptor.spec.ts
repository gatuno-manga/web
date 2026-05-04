import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { httpClientResponseInterceptor } from './http-client-response.interceptor';
import { UserTokenService } from '../service/user-token.service';
import { AuthQueueService } from '../service/auth-queue.service';
import { Subject as RxSubject } from 'rxjs';

describe('httpClientResponseInterceptor', () => {
	let httpClient: HttpClient;
	let httpMock: HttpTestingController;
	let tokenServiceSpy: jasmine.SpyObj<UserTokenService>;
	let authQueue: AuthQueueService;
	let refreshSubject: RxSubject<{ accessToken: string }>;

	beforeEach(() => {
		refreshSubject = new RxSubject<{ accessToken: string }>();
		tokenServiceSpy = jasmine.createSpyObj('UserTokenService', [
			'refreshTokens',
			'removeTokens',
		], {
			hasValidRefreshToken: true
		});

		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptors([httpClientResponseInterceptor])),
				provideHttpClientTesting(),
				{ provide: UserTokenService, useValue: tokenServiceSpy },
				AuthQueueService,
			],
		});

		httpClient = TestBed.inject(HttpClient);
		httpMock = TestBed.inject(HttpTestingController);
		authQueue = TestBed.inject(AuthQueueService);
	});

	afterEach(() => {
		httpMock.verify();
		authQueue.reset();
	});

	it('deve permitir requisições normais passarem', () => {
		httpClient.get('/data').subscribe((response) => {
			expect(response).toEqual({ data: 'ok' });
		});

		const req = httpMock.expectOne('/data');
		req.flush({ data: 'ok' });
	});

	it('deve interceptar erro 401 e iniciar processo de refresh se houver intenção de sessão', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		httpClient.get('/protected').subscribe((response) => {
			expect(response).toEqual({ data: 'recovered' });
		});

		const req = httpMock.expectOne('/protected');
		req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		expect(tokenServiceSpy.refreshTokens).toHaveBeenCalled();

		refreshSubject.next({ accessToken: 'new-token' });

		const retryReq = httpMock.expectOne('/protected');
		expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
		retryReq.flush({ data: 'recovered' });
	});

	it('NÃO deve tentar refresh em erro 401 se NÃO houver intenção de sessão (Guest)', () => {
		Object.defineProperty(tokenServiceSpy, 'hasValidRefreshToken', { get: () => false });

		httpClient.get('/books').subscribe({
			error: (err) => {
				expect(err.status).toBe(401);
			}
		});

		const req = httpMock.expectOne('/books');
		req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		expect(tokenServiceSpy.refreshTokens).not.toHaveBeenCalled();
	});

	it('deve enfileirar requisições enquanto o refresh está em andamento', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		httpClient.get('/api/1').subscribe();
		httpClient.get('/api/2').subscribe();

		const req1 = httpMock.expectOne('/api/1');
		const req2 = httpMock.expectOne('/api/2');

		req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
		req2.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		expect(tokenServiceSpy.refreshTokens).toHaveBeenCalledTimes(1);

		refreshSubject.next({ accessToken: 'new-token' });

		const retry1 = httpMock.expectOne('/api/1');
		const retry2 = httpMock.expectOne('/api/2');

		expect(retry1.request.headers.get('Authorization')).toBe('Bearer new-token');
		expect(retry2.request.headers.get('Authorization')).toBe('Bearer new-token');

		retry1.flush({ ok: 1 });
		retry2.flush({ ok: 2 });
	});

	it('deve limpar tokens e deslogar se o refresh falhar com 401/403', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		httpClient.get('/protected').subscribe({
			error: (err) => {
				expect(err.status).toBe(401);
			},
		});

		const req = httpMock.expectOne('/protected');
		req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		refreshSubject.error(new HttpErrorResponse({ status: 401, statusText: 'Expired Refresh' }));

		expect(tokenServiceSpy.removeTokens).toHaveBeenCalledWith(true);
	});

	it('NÃO deve deslogar se o refresh falhar com erro de rede ou 500', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		httpClient.get('/protected').subscribe({
			error: (err) => {
				expect(err.status).toBe(500);
			},
		});

		const req = httpMock.expectOne('/protected');
		req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		refreshSubject.error(new HttpErrorResponse({ status: 500, statusText: 'Server Error' }));

		expect(tokenServiceSpy.removeTokens).not.toHaveBeenCalled();
	});

	it('deve ignorar erro 401 em URLs de autenticação (evitar loop)', () => {
		httpClient.post('/auth/signin', {}).subscribe({
			error: (err) => {
				expect(err.status).toBe(401);
			},
		});

		const req = httpMock.expectOne('/auth/signin');
		req.flush('Invalid credentials', { status: 401, statusText: 'Unauthorized' });

		expect(tokenServiceSpy.refreshTokens).not.toHaveBeenCalled();
	});

	it('deve falhar requisições na fila se o refresh falhar', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		// Inicia primeira requisição que dispara refresh
		httpClient.get('/api/1').subscribe({ error: () => {} });
		const req1 = httpMock.expectOne('/api/1');
		req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		// Inicia segunda requisição que entra na fila
		httpClient.get('/api/2').subscribe({
			error: (err) => {
				// O erro pode ser o erro do refresh ou o erro customizado dependendo da ordem
				// O importante é que a requisição FALHE
				expect(err).toBeDefined();
			},
		});
		const req2 = httpMock.expectOne('/api/2');
		req2.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		refreshSubject.error(new HttpErrorResponse({ status: 401 }));

		expect(tokenServiceSpy.removeTokens).toHaveBeenCalled();
	});
});
