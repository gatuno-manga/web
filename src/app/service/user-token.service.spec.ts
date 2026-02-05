import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PLATFORM_ID, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { UserTokenService } from './user-token.service';
import { CookieService } from './cookie.service';
import { NotificationService } from './notification.service';
import { CrossTabSyncService, AuthSyncMessage } from './cross-tab-sync.service';
import { Subject } from 'rxjs';
import { Role } from '../models/user.models';

describe('UserTokenService', () => {
    let service: UserTokenService;
    let httpMock: HttpTestingController;
    let cookieServiceSpy: jasmine.SpyObj<CookieService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let notificationSpy: jasmine.SpyObj<NotificationService>;
    let crossTabSyncSpy: jasmine.SpyObj<CrossTabSyncService>;
    let crossTabMessages$: Subject<AuthSyncMessage>;

    // Token JWT válido de teste (expira em 1 hora)
    const createValidToken = (roles: Role[] = [Role.USER]) => {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
            email: 'test@example.com',
            sub: 'user-123',
            roles: roles,
            iss: 'gatuno',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600 // 1 hora
        }));
        const signature = btoa('fake-signature');
        return `${header}.${payload}.${signature}`;
    };

    // Token JWT expirado
    const createExpiredToken = () => {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
            email: 'test@example.com',
            sub: 'user-123',
            roles: [Role.USER],
            iss: 'gatuno',
            iat: Math.floor(Date.now() / 1000) - 7200,
            exp: Math.floor(Date.now() / 1000) - 3600 // Expirou há 1 hora
        }));
        const signature = btoa('fake-signature');
        return `${header}.${payload}.${signature}`;
    };

    beforeEach(() => {
        crossTabMessages$ = new Subject<AuthSyncMessage>();

        cookieServiceSpy = jasmine.createSpyObj('CookieService', ['get', 'set', 'delete']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        notificationSpy = jasmine.createSpyObj('NotificationService', ['show']);
        crossTabSyncSpy = jasmine.createSpyObj('CrossTabSyncService',
            ['notifyTokenUpdate', 'notifyTokenRemove'],
            { messages$: crossTabMessages$.asObservable() }
        );

        // Configuração padrão: sem token inicial
        cookieServiceSpy.get.and.returnValue(null);

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                UserTokenService,
                { provide: PLATFORM_ID, useValue: 'browser' },
                { provide: CookieService, useValue: cookieServiceSpy },
                { provide: Router, useValue: routerSpy },
                { provide: NotificationService, useValue: notificationSpy },
                { provide: CrossTabSyncService, useValue: crossTabSyncSpy }
            ]
        });

        service = TestBed.inject(UserTokenService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(fakeAsync(() => {
        // Cancela requisições pendentes
        httpMock.match(() => true).forEach(req => req.flush(null));
        discardPeriodicTasks();
        httpMock.verify();
        crossTabMessages$.complete();
    }));

    describe('inicialização', () => {
        it('deve criar o serviço', () => {
            expect(service).toBeTruthy();
        });

        it('deve ler token do cookie na inicialização', () => {
            expect(cookieServiceSpy.get).toHaveBeenCalledWith('accessToken', false);
        });
    });

    describe('Signals computed (memoização)', () => {
        it('deve retornar null quando não há token', () => {
            expect(service.accessTokenSignal()).toBeNull();
            expect(service.hasValidAccessTokenSignal()).toBeFalse();
            expect(service.isAdminSignal()).toBeFalse();
        });

        it('deve decodificar JWT e retornar valores corretos', fakeAsync(() => {
            const validToken = createValidToken([Role.ADMIN]);

            // Simula setTokens
            service.setTokens(validToken, 'refresh-token');

            // Cancela requisições de auto-refresh
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: validToken, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            // Múltiplas leituras devem retornar valores corretos
            expect(service.isAdminSignal()).toBeTrue();
            expect(service.hasValidAccessTokenSignal()).toBeTrue();
            expect(service.emailSignal()).toBe('test@example.com');
        }));

        it('deve atualizar computed quando token muda', fakeAsync(() => {
            const userToken = createValidToken([Role.USER]);
            const adminToken = createValidToken([Role.ADMIN]);

            service.setTokens(userToken, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: userToken, refreshToken: 'refresh' }));
            tick();
            expect(service.isAdminSignal()).toBeFalse();

            service.setTokens(adminToken, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: adminToken, refreshToken: 'refresh' }));
            tick();
            expect(service.isAdminSignal()).toBeTrue();

            discardPeriodicTasks();
        }));

        it('deve retornar authHeaderSignal pré-formatado', fakeAsync(() => {
            const validToken = createValidToken();

            service.setTokens(validToken, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: validToken, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            const authHeader = service.authHeaderSignal();
            expect(authHeader).toBe(`Bearer ${validToken}`);
        }));

        it('deve retornar null em authHeaderSignal quando não há token', () => {
            expect(service.authHeaderSignal()).toBeNull();
        });
    });

    describe('setTokens e removeTokens', () => {
        it('deve salvar tokens no cookie e signal', fakeAsync(() => {
            const accessToken = createValidToken();
            const refreshToken = 'refresh-token-123';

            service.setTokens(accessToken, refreshToken);
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken, refreshToken }));
            tick();
            discardPeriodicTasks();

            expect(cookieServiceSpy.set).toHaveBeenCalledWith('accessToken', accessToken, false);
            expect(cookieServiceSpy.set).toHaveBeenCalledWith('refreshToken', refreshToken, false);
            expect(service.accessTokenSignal()).toBe(accessToken);
        }));

        it('deve notificar outras abas ao definir tokens', fakeAsync(() => {
            const accessToken = createValidToken();

            service.setTokens(accessToken, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            expect(crossTabSyncSpy.notifyTokenUpdate).toHaveBeenCalledWith(accessToken);
        }));

        it('deve remover tokens e limpar signal', fakeAsync(() => {
            const accessToken = createValidToken();
            service.setTokens(accessToken, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken, refreshToken: 'refresh' }));
            tick();

            service.removeTokens();
            tick();
            discardPeriodicTasks();

            expect(cookieServiceSpy.delete).toHaveBeenCalledWith('accessToken', false);
            expect(cookieServiceSpy.delete).toHaveBeenCalledWith('refreshToken', false);
            expect(service.accessTokenSignal()).toBeNull();
        }));

        it('deve notificar outras abas ao remover tokens', fakeAsync(() => {
            service.removeTokens();
            tick();

            expect(crossTabSyncSpy.notifyTokenRemove).toHaveBeenCalled();
        }));

        it('deve mostrar notificação quando notifyUser=true', fakeAsync(() => {
            service.removeTokens(true);
            tick();

            expect(notificationSpy.show).toHaveBeenCalledWith(
                jasmine.stringContaining('sessão expirou'),
                'warning'
            );
            expect(routerSpy.navigate).toHaveBeenCalledWith(
                ['/auth/login'],
                jasmine.objectContaining({ queryParams: { sessionExpired: 'true' } })
            );
        }));
    });

    describe('sincronização entre abas (CrossTabSync)', () => {
        it('deve atualizar token quando outra aba envia TOKEN_UPDATE', fakeAsync(() => {
            const newToken = createValidToken([Role.ADMIN]);

            crossTabMessages$.next({
                type: 'TOKEN_UPDATE',
                accessToken: newToken,
                timestamp: Date.now()
            });

            // O scheduleAutoRefresh pode disparar requisição
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: newToken, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            expect(service.accessTokenSignal()).toBe(newToken);
            expect(service.isAdminSignal()).toBeTrue();
        }));

        it('deve limpar token quando outra aba envia TOKEN_REMOVE', fakeAsync(() => {
            const accessToken = createValidToken();
            service.setTokens(accessToken, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken, refreshToken: 'refresh' }));
            tick();

            expect(service.accessTokenSignal()).toBe(accessToken);

            crossTabMessages$.next({
                type: 'TOKEN_REMOVE',
                accessToken: null,
                timestamp: Date.now()
            });
            tick();
            discardPeriodicTasks();

            expect(service.accessTokenSignal()).toBeNull();
        }));

        it('não deve mostrar notificação ao receber mensagem de outra aba', fakeAsync(() => {
            crossTabMessages$.next({
                type: 'TOKEN_REMOVE',
                accessToken: null,
                timestamp: Date.now()
            });
            tick();

            expect(notificationSpy.show).not.toHaveBeenCalled();
        }));
    });

    describe('validação de token', () => {
        it('deve identificar token válido', fakeAsync(() => {
            const validToken = createValidToken();
            service.setTokens(validToken, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: validToken, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            expect(service.hasValidAccessToken).toBeTrue();
            expect(service.hasValidAccessTokenSignal()).toBeTrue();
        }));

        it('deve identificar token expirado', fakeAsync(() => {
            const expiredToken = createExpiredToken();

            // Força atualização do signal interno
            (service as any)._accessToken.set(expiredToken);
            tick();

            expect(service.hasValidAccessTokenSignal()).toBeFalse();
        }));

        it('deve retornar false para token inválido/malformado', fakeAsync(() => {
            (service as any)._accessToken.set('token-invalido');
            tick();

            expect(service.hasValidAccessTokenSignal()).toBeFalse();
            expect(service.isAdminSignal()).toBeFalse();
        }));
    });

    describe('roles e informações do usuário', () => {
        it('deve retornar roles do usuário', fakeAsync(() => {
            const token = createValidToken([Role.USER, Role.ADMIN]);
            service.setTokens(token, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: token, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            const roles = service.rolesSignal();
            expect(roles).toContain(Role.USER);
            expect(roles).toContain(Role.ADMIN);
        }));

        it('deve identificar admin corretamente', fakeAsync(() => {
            const adminToken = createValidToken([Role.ADMIN]);
            const userToken = createValidToken([Role.USER]);

            service.setTokens(adminToken, 'refresh');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: adminToken, refreshToken: 'refresh' }));
            tick();
            expect(service.isAdmin).toBeTrue();
            expect(service.isAdminSignal()).toBeTrue();

            service.setTokens(userToken, 'refresh');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: userToken, refreshToken: 'refresh' }));
            tick();
            expect(service.isAdmin).toBeFalse();
            expect(service.isAdminSignal()).toBeFalse();

            discardPeriodicTasks();
        }));

        it('deve retornar email do usuário', fakeAsync(() => {
            const token = createValidToken();
            service.setTokens(token, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: token, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            expect(service.emailSignal()).toBe('test@example.com');
        }));

        it('deve retornar ID do usuário', fakeAsync(() => {
            const token = createValidToken();
            service.setTokens(token, 'refresh-token');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: token, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            expect(service.userIdSignal()).toBe('user-123');
        }));
    });

    describe('refreshTokens', () => {
        it('deve fazer refresh e atualizar tokens', fakeAsync(() => {
            const newAccessToken = createValidToken([Role.ADMIN]);
            const newRefreshToken = 'new-refresh-token';

            service.refreshTokens().subscribe();

            const req = httpMock.expectOne('/auth/refresh');
            expect(req.request.method).toBe('GET');

            req.flush({ accessToken: newAccessToken, refreshToken: newRefreshToken });
            tick();
            discardPeriodicTasks();

            expect(cookieServiceSpy.set).toHaveBeenCalledWith('accessToken', newAccessToken, false);
            expect(cookieServiceSpy.set).toHaveBeenCalledWith('refreshToken', newRefreshToken, false);
        }));

        it('deve compartilhar observable para chamadas simultâneas (shareReplay)', fakeAsync(() => {
            const newAccessToken = createValidToken();
            let callCount = 0;

            // Múltiplas chamadas simultâneas
            service.refreshTokens().subscribe(() => callCount++);
            service.refreshTokens().subscribe(() => callCount++);
            service.refreshTokens().subscribe(() => callCount++);

            // Apenas UMA requisição HTTP
            const requests = httpMock.match('/auth/refresh');
            expect(requests.length).toBe(1);

            requests[0].flush({ accessToken: newAccessToken, refreshToken: 'refresh' });
            tick();
            discardPeriodicTasks();

            // Todos os subscribers recebem o resultado
            expect(callCount).toBe(3);
        }));
    });

    describe('getters legados (compatibilidade)', () => {
        it('deve retornar accessToken via getter', fakeAsync(() => {
            const token = createValidToken();
            service.setTokens(token, 'refresh');
            httpMock.match('/auth/refresh').forEach(req => req.flush({ accessToken: token, refreshToken: 'refresh' }));
            tick();
            discardPeriodicTasks();

            // Getter usa o signal internamente
            expect(service.accessToken).toBe(token);
        }));

        it('deve retornar refreshToken via cookie', () => {
            cookieServiceSpy.get.and.returnValue('refresh-token-from-cookie');
            expect(service.refreshToken).toBe('refresh-token-from-cookie');
        });
    });
});
