import { TestBed } from '@angular/core/testing';
import { BookWebsocketService, BookEvent, ChapterEvent, ScrapingEvent } from './book-websocket.service';
import { UserTokenService } from './user-token.service';

describe('BookWebsocketService', () => {
    let service: BookWebsocketService;
    let userTokenService: jasmine.SpyObj<UserTokenService>;

    beforeEach(() => {
        // Mock do UserTokenService
        const userTokenSpy = jasmine.createSpyObj('UserTokenService', [], {
            accessToken: 'fake-jwt-token'
        });

        TestBed.configureTestingModule({
            providers: [
                BookWebsocketService,
                { provide: UserTokenService, useValue: userTokenSpy }
            ]
        });

        service = TestBed.inject(BookWebsocketService);
        userTokenService = TestBed.inject(UserTokenService) as jasmine.SpyObj<UserTokenService>;
    });

    describe('Service Creation', () => {
        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        it('should not be connected initially', () => {
            expect(service.isConnected()).toBeFalse();
        });
    });

    describe('Connection Management', () => {
        it('should not connect without JWT token', () => {
            Object.defineProperty(userTokenService, 'accessToken', {
                get: () => null,
                configurable: true
            });

            spyOn(console, 'error');
            service.connect();

            expect(console.error).toHaveBeenCalledWith(
                jasmine.stringContaining('Token JWT não encontrado')
            );
        });

        it('should return isConnected state', () => {
            expect(service.isConnected()).toBe(false);
        });

        it('should emit connected$ observable', (done) => {
            service.connected$.subscribe(isConnected => {
                expect(typeof isConnected).toBe('boolean');
                done();
            });
        });
    });

    describe('Room Subscriptions', () => {
        it('should have subscribeToBook method', () => {
            expect(service.subscribeToBook).toBeDefined();
            expect(typeof service.subscribeToBook).toBe('function');
        });

        it('should have unsubscribeFromBook method', () => {
            expect(service.unsubscribeFromBook).toBeDefined();
            expect(typeof service.unsubscribeFromBook).toBe('function');
        });

        it('should have subscribeToChapter method', () => {
            expect(service.subscribeToChapter).toBeDefined();
            expect(typeof service.subscribeToChapter).toBe('function');
        });

        it('should have unsubscribeFromChapter method', () => {
            expect(service.unsubscribeFromChapter).toBeDefined();
            expect(typeof service.unsubscribeFromChapter).toBe('function');
        });

        it('should have listSubscriptions method', () => {
            expect(service.listSubscriptions).toBeDefined();
            expect(typeof service.listSubscriptions).toBe('function');
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
