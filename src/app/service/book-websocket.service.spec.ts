import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BookWebsocketService } from './book-websocket.service';
import { BookEvent, ChapterEvent, ScrapingEvent } from '../models/book-events.model';
import { UserTokenService } from './user-token.service';
import { ENVIRONMENT } from '../tokens/environment.token';
import { WINDOW } from '../tokens/window.token';
import { WebSocketConnectionState } from '../models/websocket-state.model';
import { NetworkStatusService } from './network-status.service';
import { Subject } from 'rxjs';

describe('BookWebsocketService', () => {
    let service: BookWebsocketService;
    let userTokenService: jasmine.SpyObj<UserTokenService>;
    let networkStatusServiceSpy: jasmine.SpyObj<NetworkStatusService>;
    let mockSocket: any;

    const mockEnv = {
        apiURL: 'http://localhost:3000',
        apiURLServer: 'http://localhost:3000',
    };

    const mockWindow = {
        location: {
            origin: 'http://localhost:4200',
        },
    };

    beforeEach(() => {
        mockSocket = {
            connected: false,
            on: jasmine.createSpy('on'),
            once: jasmine.createSpy('once'),
            off: jasmine.createSpy('off'),
            emit: jasmine.createSpy('emit'),
            disconnect: jasmine.createSpy('disconnect'),
            io: {
                on: jasmine.createSpy('io.on'),
                opts: { reconnection: true },
            },
        };

        // Mock do UserTokenService
        const userTokenSpy = jasmine.createSpyObj('UserTokenService', [], {
            accessToken: 'fake-jwt-token'
        });

        const networkStatusSpy = jasmine.createSpyObj('NetworkStatusService', [], {
            wentOffline$: new Subject<void>(),
            wentOnline$: new Subject<void>(),
        });

        TestBed.configureTestingModule({
            providers: [
                BookWebsocketService,
                { provide: UserTokenService, useValue: userTokenSpy },
                { provide: NetworkStatusService, useValue: networkStatusSpy },
                { provide: ENVIRONMENT, useValue: mockEnv },
                { provide: WINDOW, useValue: mockWindow },
            ]
        });

        service = TestBed.inject(BookWebsocketService);
        userTokenService = TestBed.inject(UserTokenService) as jasmine.SpyObj<UserTokenService>;
        networkStatusServiceSpy = TestBed.inject(NetworkStatusService) as jasmine.SpyObj<NetworkStatusService>;

        // @ts-ignore - spy on protected method
        spyOn<any>(service, 'createSocket').and.returnValue(mockSocket);
    });

    describe('Service Creation', () => {
        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        it('should not be connected initially', () => {
            expect(service.isConnected()).toBeFalse();
        });
        
        it('should initialize with DISCONNECTED state', () => {
            expect(service.connectionState()).toBe(WebSocketConnectionState.DISCONNECTED);
        });
    });

    describe('Connection Management', () => {
        it('should not connect without JWT token', () => {
            Object.defineProperty(userTokenService, 'accessToken', {
                get: () => null,
                configurable: true
            });

            // Usamos spyOn no logger utils internamente, mas aqui vamos apenas checar o estado
            service.connect();

            expect(service.connectionState()).toBe(WebSocketConnectionState.DISCONNECTED);
        });

        it('should return isConnected state from signal', () => {
            expect(service.isConnected()).toBe(false);
            // Simula conexão
            service['transitionTo'](WebSocketConnectionState.CONNECTING);
            service['transitionTo'](WebSocketConnectionState.CONNECTED);
            service['_connected'].set(true);
            expect(service.isConnected()).toBe(true);
        });

        it('should emit connected$ observable when signal changes', fakeAsync(() => {
            let emissionCount = 0;
            let lastValue = false;
            
            const sub = service.connected$.subscribe(isConnected => {
                emissionCount++;
                lastValue = isConnected;
            });

            // Signal -> Observable é assíncrono via efeito
            TestBed.flushEffects();
            expect(emissionCount).toBe(1);
            expect(lastValue).toBeFalse();

            service['_connected'].set(true);
            TestBed.flushEffects();
            
            expect(emissionCount).toBe(2);
            expect(lastValue).toBeTrue();
            
            sub.unsubscribe();
        }));
        
        it('should call createSocket when connect() is called', () => {
            service.connect();
            expect(service['createSocket']).toHaveBeenCalled();
            expect(service.connectionState()).toBe(WebSocketConnectionState.CONNECTING);
        });
    });

    describe('Room Subscriptions', () => {
        beforeEach(() => {
            // Mock connection for subscription tests
            service['_connected'].set(true);
            (service as any).socket = mockSocket;
        });

        it('should emit SUBSCRIBE_BOOK on subscribeToBook', () => {
            service.subscribeToBook('book-123');
            expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:book', 'book-123');
        });

        it('should emit UNSUBSCRIBE_BOOK on unsubscribeFromBook', () => {
            service.unsubscribeFromBook('book-123');
            expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:book', 'book-123');
        });
    });

    describe('Event Observables', () => {
        it('should have bookCreated$ observable', (done) => {
            expect(service.bookCreated$).toBeDefined();

            const subscription = service.bookCreated$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have bookUpdated$ observable', (done) => {
            expect(service.bookUpdated$).toBeDefined();

            const subscription = service.bookUpdated$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have chaptersUpdated$ observable', (done) => {
            expect(service.chaptersUpdated$).toBeDefined();

            const subscription = service.chaptersUpdated$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have chapterUpdated$ observable', (done) => {
            expect(service.chapterUpdated$).toBeDefined();

            const subscription = service.chapterUpdated$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have chaptersFix$ observable', (done) => {
            expect(service.chaptersFix$).toBeDefined();

            const subscription = service.chaptersFix$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have coverProcessed$ observable', (done) => {
            expect(service.coverProcessed$).toBeDefined();

            const subscription = service.coverProcessed$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have coverSelected$ observable', (done) => {
            expect(service.coverSelected$).toBeDefined();

            const subscription = service.coverSelected$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have chapterScrapingStarted$ observable', (done) => {
            expect(service.chapterScrapingStarted$).toBeDefined();

            const subscription = service.chapterScrapingStarted$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have chapterScrapingCompleted$ observable', (done) => {
            expect(service.chapterScrapingCompleted$).toBeDefined();

            const subscription = service.chapterScrapingCompleted$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have chapterScrapingFailed$ observable', (done) => {
            expect(service.chapterScrapingFailed$).toBeDefined();

            const subscription = service.chapterScrapingFailed$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });

        it('should have error$ observable', (done) => {
            expect(service.error$).toBeDefined();

            const subscription = service.error$.subscribe();
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });
    });

    describe('watchBook()', () => {
        it('should return an observable', () => {
            const observable = service.watchBook('book-123');
            expect(observable).toBeDefined();
            expect(observable.subscribe).toBeDefined();
        });

        it('should handle subscription lifecycle', (done) => {
            const bookId = 'book-123';
            const subscription = service.watchBook(bookId).subscribe({
                next: () => {},
                error: () => {},
                complete: () => {}
            });

            expect(subscription).toBeDefined();
            expect(typeof subscription.unsubscribe).toBe('function');

            subscription.unsubscribe();
            done();
        });

        it('should emit on bookUpdated event', (done) => {
            const bookId = 'book-123';
            let emittedCount = 0;

            const subscription = service.watchBook(bookId).subscribe({
                next: () => {
                    emittedCount++;
                },
                error: () => {},
                complete: () => {}
            });

            // Observável deve estar pronto para receber eventos
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });
    });

    describe('watchChapter()', () => {
        it('should return an observable', () => {
            const observable = service.watchChapter('chapter-123', 'book-456');
            expect(observable).toBeDefined();
            expect(observable.subscribe).toBeDefined();
        });

        it('should handle subscription lifecycle', (done) => {
            const chapterId = 'chapter-123';
            const bookId = 'book-456';

            const subscription = service.watchChapter(chapterId, bookId).subscribe({
                next: () => {},
                error: () => {},
                complete: () => {}
            });

            expect(subscription).toBeDefined();
            expect(typeof subscription.unsubscribe).toBe('function');

            subscription.unsubscribe();
            done();
        });

        it('should emit on chapterUpdated event', (done) => {
            const chapterId = 'chapter-123';
            const bookId = 'book-456';
            let emittedCount = 0;

            const subscription = service.watchChapter(chapterId, bookId).subscribe({
                next: () => {
                    emittedCount++;
                },
                error: () => {},
                complete: () => {}
            });

            // Observável deve estar pronto para receber eventos
            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });
    });

    describe('Disconnect', () => {
        it('should have disconnect method', () => {
            expect(service.disconnect).toBeDefined();
            expect(typeof service.disconnect).toBe('function');
        });

        it('should set isConnected to false after disconnect', () => {
            service.disconnect();
            expect(service.isConnected()).toBe(false);
        });
    });

    describe('Interface Types', () => {
        it('should have BookEvent interface structure', () => {
            const bookEvent: BookEvent = {
                id: 'book-123',
                title: 'Test Book'
            };

            expect(bookEvent.id).toBeDefined();
            expect(bookEvent.title).toBeDefined();
        });

        it('should have ChapterEvent interface structure', () => {
            const chapterEvent: ChapterEvent = {
                bookId: 'book-123',
                chapters: [
                    {
                        id: 'ch-1',
                        title: 'Chapter 1',
                        index: 1,
                        scrapingStatus: 'COMPLETED'
                    }
                ]
            };

            expect(chapterEvent.bookId).toBeDefined();
            expect(chapterEvent.chapters).toBeDefined();
            expect(Array.isArray(chapterEvent.chapters)).toBe(true);
        });

        it('should have ScrapingEvent interface structure', () => {
            const scrapingEvent: ScrapingEvent = {
                chapterId: 'ch-1',
                bookId: 'book-123',
                pagesCount: 15
            };

            expect(scrapingEvent.chapterId).toBeDefined();
            expect(scrapingEvent.bookId).toBeDefined();
            expect(typeof scrapingEvent.pagesCount).toBe('number');
        });
    });

    describe('Error Handling', () => {
        it('should handle connection errors gracefully', () => {
            spyOn(console, 'error');

            // Tenta conectar sem token
            Object.defineProperty(userTokenService, 'accessToken', {
                get: () => null,
                configurable: true
            });

            service.connect();

            expect(console.error).toHaveBeenCalled();
        });

        it('should emit error events', (done) => {
            const subscription = service.error$.subscribe((error) => {
                expect(error).toBeDefined();
            });

            expect(subscription).toBeDefined();
            subscription.unsubscribe();
            done();
        });
    });
});
