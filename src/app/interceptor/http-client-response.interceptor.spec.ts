import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { httpClientResponseInterceptor } from './http-client-response.interceptor';
import { UserTokenService } from '../service/user-token.service';
import { AuthQueueService } from '../service/auth-queue.service';
import { of, throwError, Subject as RxSubject } from 'rxjs';

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
		]);

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

	it('deve interceptar erro 401 e iniciar processo de refresh', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		httpClient.get('/protected').subscribe((response) => {
			expect(response).toEqual({ data: 'recovered' });
		});

		// Primeira tentativa falha com 401
		const req = httpMock.expectOne('/protected');
		req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		expect(tokenServiceSpy.refreshTokens).toHaveBeenCalled();

		// Completa o refresh
		refreshSubject.next({ accessToken: 'new-token' });

		// Interceptador deve repetir a requisição com o novo token
		const retryReq = httpMock.expectOne('/protected');
		expect(retryReq.request.headers.get('Authorization')).toBe(
			'Bearer new-token',
		);
		retryReq.flush({ data: 'recovered' });
	});

	it('deve enfileirar requisições enquanto o refresh está em andamento', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		// Disparamos duas requisições
		httpClient.get('/api/1').subscribe();
		httpClient.get('/api/2').subscribe();

		// Ambas falham com 401
		const req1 = httpMock.expectOne('/api/1');
		const req2 = httpMock.expectOne('/api/2');

		// Simula que a primeira dispara o refresh
		req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
		// Simula que a segunda chega enquanto a primeira ainda está processando o refresh
		req2.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		// refreshTokens deve ser chamado apenas UMA vez
		expect(tokenServiceSpy.refreshTokens).toHaveBeenCalledTimes(1);

		// Completa o refresh
		refreshSubject.next({ accessToken: 'new-token' });

		// Após sucesso do refresh, AMBAS devem ser repetidas
		const retry1 = httpMock.expectOne('/api/1');
		const retry2 = httpMock.expectOne('/api/2');

		expect(retry1.request.headers.get('Authorization')).toBe('Bearer new-token');
		expect(retry2.request.headers.get('Authorization')).toBe('Bearer new-token');

		retry1.flush({ ok: 1 });
		retry2.flush({ ok: 2 });
	});

	it('deve limpar tokens e deslogar se o refresh falhar', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		httpClient.get('/protected').subscribe({
			error: (err) => {
				// O erro propagado é o erro do refresh
				expect(err.message).toBe('Refresh Failed');
			},
		});

		const req = httpMock.expectOne('/protected');
		req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		refreshSubject.error(new Error('Refresh Failed'));

		expect(tokenServiceSpy.removeTokens).toHaveBeenCalledWith(true);
	});

	it('deve ignorar erro 401 em URLs de autenticação (evitar loop)', () => {
		httpClient.post('/auth/signin', {}).subscribe({
			error: (err) => {
				expect(err.status).toBe(401);
			},
		});

		const req = httpMock.expectOne('/auth/signin');
		req.flush('Invalid credentials', {
			status: 401,
			statusText: 'Unauthorized',
		});

		expect(tokenServiceSpy.refreshTokens).not.toHaveBeenCalled();
	});

	it('deve falhar requisições na fila se o refresh falhar', () => {
		tokenServiceSpy.refreshTokens.and.returnValue(refreshSubject.asObservable());

		httpClient.get('/api/1').subscribe({ error: () => {} });
		httpClient.get('/api/2').subscribe({
			error: (err) => {
				expect(err.message).toContain('Falha na renovação');
			},
		});

		const req1 = httpMock.expectOne('/api/1');
		const req2 = httpMock.expectOne('/api/2');

		req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
		req2.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

		refreshSubject.error(new Error('Refresh Failed'));

		expect(tokenServiceSpy.removeTokens).toHaveBeenCalled();
	});
});
