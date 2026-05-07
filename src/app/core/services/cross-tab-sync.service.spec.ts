import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { CrossTabSyncService, AuthSyncMessage } from './cross-tab-sync.service';

describe('CrossTabSyncService', () => {
    let service: CrossTabSyncService;

    // Mock do localStorage
    let mockLocalStorage: { [key: string]: string } = {};
    let storageEventListeners: ((event: StorageEvent) => void)[] = [];

    describe('com fallback StorageEvent (sem BroadcastChannel)', () => {
        let originalBroadcastChannel: typeof BroadcastChannel;
        let addEventListenerSpy: jasmine.Spy;
        let removeEventListenerSpy: jasmine.Spy;

        beforeEach(() => {
            // Remove BroadcastChannel para forçar fallback
            originalBroadcastChannel = (window as any).BroadcastChannel;
            delete (window as any).BroadcastChannel;

            // Mock localStorage
            spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => {
                mockLocalStorage[key] = value;
            });
            spyOn(localStorage, 'removeItem').and.callFake((key: string) => {
                delete mockLocalStorage[key];
            });
            spyOn(localStorage, 'getItem').and.callFake((key: string) => mockLocalStorage[key] || null);

            // Mock addEventListener para storage
            storageEventListeners = [];
            addEventListenerSpy = spyOn(window, 'addEventListener').and.callFake((type: string, listener: any) => {
                if (type === 'storage') {
                    storageEventListeners.push(listener);
                }
            });
            removeEventListenerSpy = spyOn(window, 'removeEventListener').and.callFake((type: string, listener: any) => {
                if (type === 'storage') {
                    const index = storageEventListeners.indexOf(listener);
                    if (index > -1) {
                        storageEventListeners.splice(index, 1);
                    }
                }
            });

            TestBed.configureTestingModule({
                providers: [
                    CrossTabSyncService,
                    { provide: PLATFORM_ID, useValue: 'browser' }
                ]
            });

            service = TestBed.inject(CrossTabSyncService);
        });

        afterEach(() => {
            service.ngOnDestroy();
            mockLocalStorage = {};
            // Restaura BroadcastChannel
            (window as any).BroadcastChannel = originalBroadcastChannel;
        });

        it('deve usar StorageEvent como fallback', () => {
            expect(service.isUsingBroadcastChannel).toBeFalse();
        });

        it('deve registrar listener de storage event', () => {
            expect(addEventListenerSpy).toHaveBeenCalledWith('storage', jasmine.any(Function));
        });

        it('deve enviar mensagem via localStorage', () => {
            service.notifyTokenUpdate('token-via-storage');

            expect(localStorage.setItem).toHaveBeenCalledWith(
                '@gatuno/auth-sync',
                jasmine.any(String)
            );
            expect(localStorage.removeItem).toHaveBeenCalledWith('@gatuno/auth-sync');
        });

        it('deve emitir mensagens recebidas via StorageEvent', fakeAsync(() => {
            const receivedMessages: AuthSyncMessage[] = [];
            service.messages$.subscribe(msg => receivedMessages.push(msg));

            const testMessage: AuthSyncMessage = {
                type: 'TOKEN_REMOVE',
                accessToken: null,
                timestamp: Date.now()
            };

            // Simula StorageEvent de outra aba
            const storageEvent = new StorageEvent('storage', {
                key: '@gatuno/auth-sync',
                newValue: JSON.stringify(testMessage),
                oldValue: null
            });

            storageEventListeners.forEach(listener => listener(storageEvent));
            tick();

            expect(receivedMessages.length).toBe(1);
            expect(receivedMessages[0].type).toBe('TOKEN_REMOVE');
        }));

        it('deve ignorar StorageEvent com chave diferente', fakeAsync(() => {
            const receivedMessages: AuthSyncMessage[] = [];
            service.messages$.subscribe(msg => receivedMessages.push(msg));

            const storageEvent = new StorageEvent('storage', {
                key: 'outra-chave',
                newValue: '{"type": "TOKEN_UPDATE"}',
                oldValue: null
            });

            storageEventListeners.forEach(listener => listener(storageEvent));
            tick();

            expect(receivedMessages.length).toBe(0);
        }));

        it('deve ignorar StorageEvent com valor inválido', fakeAsync(() => {
            const receivedMessages: AuthSyncMessage[] = [];
            service.messages$.subscribe(msg => receivedMessages.push(msg));

            const storageEvent = new StorageEvent('storage', {
                key: '@gatuno/auth-sync',
                newValue: 'json-invalido{{{',
                oldValue: null
            });

            // Não deve lançar erro
            expect(() => {
                storageEventListeners.forEach(listener => listener(storageEvent));
                tick();
            }).not.toThrow();

            expect(receivedMessages.length).toBe(0);
        }));

        it('deve remover listener no ngOnDestroy', () => {
            service.ngOnDestroy();
            expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', jasmine.any(Function));
        });
    });

    describe('em ambiente SSR (server)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    CrossTabSyncService,
                    { provide: PLATFORM_ID, useValue: 'server' }
                ]
            });

            service = TestBed.inject(CrossTabSyncService);
        });

        afterEach(() => {
            service.ngOnDestroy();
        });

        it('deve criar o serviço sem erros', () => {
            expect(service).toBeTruthy();
        });

        it('deve ter isUsingBroadcastChannel como false', () => {
            expect(service.isUsingBroadcastChannel).toBeFalse();
        });

        it('não deve lançar erro ao chamar notifyTokenUpdate', () => {
            expect(() => service.notifyTokenUpdate('token')).not.toThrow();
        });

        it('não deve lançar erro ao chamar notifyTokenRemove', () => {
            expect(() => service.notifyTokenRemove()).not.toThrow();
        });
    });

    describe('com BroadcastChannel disponível (comportamento real)', () => {
        // Testes usando o BroadcastChannel real do navegador
        // Estes testes verificam a integração real quando disponível

        beforeEach(() => {
            // Usa o BroadcastChannel real se disponível
            if (typeof BroadcastChannel === 'undefined') {
                pending('BroadcastChannel não disponível neste ambiente');
            }

            TestBed.configureTestingModule({
                providers: [
                    CrossTabSyncService,
                    { provide: PLATFORM_ID, useValue: 'browser' }
                ]
            });

            service = TestBed.inject(CrossTabSyncService);
        });

        afterEach(() => {
            if (service) {
                service.ngOnDestroy();
            }
        });

        it('deve usar BroadcastChannel quando disponível', () => {
            expect(service.isUsingBroadcastChannel).toBeTrue();
        });

        it('deve criar o serviço sem erros', () => {
            expect(service).toBeTruthy();
        });

        it('não deve lançar erro ao chamar notifyTokenUpdate', () => {
            expect(() => service.notifyTokenUpdate('token')).not.toThrow();
        });

        it('não deve lançar erro ao chamar notifyTokenRemove', () => {
            expect(() => service.notifyTokenRemove()).not.toThrow();
        });
    });
});
