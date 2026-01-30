import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserTokenService } from './user-token.service';
import { BookEvents } from '../constants/book-events.constants';
import {
    BookEvent,
    ChapterEvent,
    CoverEvent,
    NewChaptersEvent,
    ScrapingEvent,
    SubscriptionResponse,
    SubscriptionsListResponse,
    UpdateCompletedEvent,
    UpdateFailedEvent,
    UpdateStartedEvent
} from '../models/book-events.model';

/**
 * Service para gerenciar conexões WebSocket e receber eventos em tempo real
 * Implementa o padrão Observer no lado do cliente com sistema de Rooms
 *
 * Features:
 * - Autenticação JWT automática
 * - Sistema de inscrição em livros e capítulos
 * - Reconexão automática
 * - Tracking de estado de conexão
 */
@Injectable({
    providedIn: 'root'
})
export class BookWebsocketService {
    private socket: Socket | null = null;
    private connectedSubject = new BehaviorSubject<boolean>(false);
    private subscribedBooks = new Set<string>();
    private subscribedChapters = new Set<string>();

    // Subjects para eventos
    private bookCreatedSubject = new Subject<BookEvent>();
    private bookUpdatedSubject = new Subject<BookEvent>();
    private bookNewChaptersSubject = new Subject<NewChaptersEvent>();
    private bookUpdateStartedSubject = new Subject<UpdateStartedEvent>();
    private bookUpdateCompletedSubject = new Subject<UpdateCompletedEvent>();
    private bookUpdateFailedSubject = new Subject<UpdateFailedEvent>();
    private chaptersUpdatedSubject = new Subject<ChapterEvent>();
    private chapterUpdatedSubject = new Subject<ChapterEvent>();
    private chaptersFixSubject = new Subject<ChapterEvent>();
    private coverProcessedSubject = new Subject<CoverEvent>();
    private coverSelectedSubject = new Subject<CoverEvent>();
    private chapterScrapingStartedSubject = new Subject<ScrapingEvent>();
    private chapterScrapingCompletedSubject = new Subject<ScrapingEvent>();
    private chapterScrapingFailedSubject = new Subject<ScrapingEvent>();
    private errorSubject = new Subject<{ message: string }>();

    // Observables públicos
    public connected$ = this.connectedSubject.asObservable();
    public bookCreated$ = this.bookCreatedSubject.asObservable();
    public bookUpdated$ = this.bookUpdatedSubject.asObservable();
    public bookNewChapters$ = this.bookNewChaptersSubject.asObservable();
    public bookUpdateStarted$ = this.bookUpdateStartedSubject.asObservable();
    public bookUpdateCompleted$ = this.bookUpdateCompletedSubject.asObservable();
    public bookUpdateFailed$ = this.bookUpdateFailedSubject.asObservable();
    public chaptersUpdated$ = this.chaptersUpdatedSubject.asObservable();
    public chapterUpdated$ = this.chapterUpdatedSubject.asObservable();
    public chaptersFix$ = this.chaptersFixSubject.asObservable();
    public coverProcessed$ = this.coverProcessedSubject.asObservable();
    public coverSelected$ = this.coverSelectedSubject.asObservable();
    public chapterScrapingStarted$ = this.chapterScrapingStartedSubject.asObservable();
    public chapterScrapingCompleted$ = this.chapterScrapingCompletedSubject.asObservable();
    public chapterScrapingFailed$ = this.chapterScrapingFailedSubject.asObservable();
    public error$ = this.errorSubject.asObservable();

    constructor(private userTokenService: UserTokenService) {}

    /**
     * Conecta ao WebSocket com autenticação JWT
     */
    connect(): void {
        if (this.connectedSubject.value) {
            console.log('WebSocket já está conectado');
            return;
        }

        const token = this.userTokenService.accessToken;
        if (!token) {
            console.error('❌ Token JWT não encontrado. Não é possível conectar ao WebSocket.');
            return;
        }

        const serverUrl = environment.apiURL.replace('/api', '');
        console.log('🔌 Conectando ao WebSocket:', `${serverUrl}/books`);

        this.socket = io(`${serverUrl}/books`, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            timeout: 10000,
            forceNew: true,
            autoConnect: true,
        });

        this.socket.on('connect', () => {
            console.log('✅ WebSocket conectado:', this.socket?.id);
            this.connectedSubject.next(true);
            this.resubscribeAll();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('⚠️ WebSocket desconectado. Razão:', reason);
            this.connectedSubject.next(false);
        });

        this.socket.on('connect_error', (error: any) => {
            console.error('❌ Erro de conexão WebSocket:', error.message);
            this.connectedSubject.next(false);
        });

        this.socket.on('error', (error: any) => {
            console.error('❌ Erro WebSocket:', error);
            this.errorSubject.next(error);
        });

        this.registerEventListeners();
    }

    /**
     * Desconecta do WebSocket
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connectedSubject.next(false);
            this.subscribedBooks.clear();
            this.subscribedChapters.clear();
            console.log('🔌 WebSocket desconectado');
        }
    }

    /**
     * Verifica se está conectado
     */
    isConnected(): boolean {
        return this.connectedSubject.value;
    }

    /**
     * Registra os listeners para todos os eventos do WebSocket
     */
    private registerEventListeners(): void {
        if (!this.socket) return;

        // Helper para registrar eventos de forma mais limpa
        const register = <T>(event: string, subject: Subject<T>, logPrefix: string, isError = false) => {
            this.socket?.on(event, (data: T) => {
                if (isError) {
                    console.error(logPrefix, data);
                } else {
                    console.log(logPrefix, data);
                }
                subject.next(data);
            });
        };

        // --- Eventos de Confirmação ---
        this.socket.on('subscribed', (data: SubscriptionResponse) => {
            if (data.success) {
                console.log(`✅ Inscrito em ${data.type}:`, data.id);
            } else {
                console.error(`❌ Falha ao inscrever em ${data.type}:`, data.error);
            }
        });

        this.socket.on('unsubscribed', (data: SubscriptionResponse) => {
            if (data.success) {
                console.log(`🚪 Inscrição cancelada em ${data.type}:`, data.id);
            }
        });

        this.socket.on('subscriptions', (data: SubscriptionsListResponse) => {
            console.log('📋 Minhas inscrições:', data);
        });

        // --- Eventos de Livros ---
        register(BookEvents.CREATED, this.bookCreatedSubject, '📚 Livro criado:');
        register(BookEvents.UPDATED, this.bookUpdatedSubject, '📝 Livro atualizado:');
        register(BookEvents.NEW_CHAPTERS, this.bookNewChaptersSubject, '🆕 Novos capítulos encontrados:');
        register(BookEvents.UPDATE_STARTED, this.bookUpdateStartedSubject, '🔄 Atualização iniciada:');
        register(BookEvents.UPDATE_COMPLETED, this.bookUpdateCompletedSubject, '✅ Atualização concluída:');
        register(BookEvents.UPDATE_FAILED, this.bookUpdateFailedSubject, '❌ Atualização falhou:', true);

        // --- Eventos de Capítulos ---
        register(BookEvents.CHAPTERS_UPDATED, this.chaptersUpdatedSubject, '📚 Capítulos atualizados:');
        register(BookEvents.CHAPTER_UPDATED, this.chapterUpdatedSubject, '📖 Capítulo atualizado:');
        register(BookEvents.CHAPTERS_FIX, this.chaptersFixSubject, '🔧 Capítulos para corrigir:');

        // --- Eventos de Scraping ---
        register(BookEvents.SCRAPING_STARTED, this.chapterScrapingStartedSubject, '🔄 Scraping iniciado:');
        register(BookEvents.SCRAPING_COMPLETED, this.chapterScrapingCompletedSubject, '✅ Scraping completo:');
        register(BookEvents.SCRAPING_FAILED, this.chapterScrapingFailedSubject, '❌ Scraping falhou:', true);

        // --- Eventos de Capas ---
        register(BookEvents.COVER_PROCESSED, this.coverProcessedSubject, '🖼️ Capa processada:');
        register(BookEvents.COVER_SELECTED, this.coverSelectedSubject, '🎨 Capa selecionada:');
    }

    // ==================== MÉTODOS DE INSCRIÇÃO ====================

    /**
     * Inscreve-se em um livro específico
     */
    subscribeToBook(bookId: string): void {
        if (!this.socket || !this.connectedSubject.value) {
            console.warn('⚠️ WebSocket não conectado. Não é possível inscrever-se no livro.');
            return;
        }

        this.socket.emit(BookEvents.SUBSCRIBE_BOOK, bookId);
        this.subscribedBooks.add(bookId);
    }

    /**
     * Cancela inscrição em um livro
     */
    unsubscribeFromBook(bookId: string): void {
        if (!this.socket) return;

        this.socket.emit(BookEvents.UNSUBSCRIBE_BOOK, bookId);
        this.subscribedBooks.delete(bookId);
    }

    /**
     * Inscreve-se em um capítulo específico
     */
    subscribeToChapter(chapterId: string): void {
        if (!this.socket || !this.connectedSubject.value) {
            console.warn('⚠️ WebSocket não conectado. Não é possível inscrever-se no capítulo.');
            return;
        }

        this.socket.emit(BookEvents.SUBSCRIBE_CHAPTER, chapterId);
        this.subscribedChapters.add(chapterId);
    }

    /**
     * Cancela inscrição em um capítulo
     */
    unsubscribeFromChapter(chapterId: string): void {
        if (!this.socket) return;

        this.socket.emit(BookEvents.UNSUBSCRIBE_CHAPTER, chapterId);
        this.subscribedChapters.delete(chapterId);
    }

    /**
     * Lista todas as inscrições atuais
     */
    listSubscriptions(): void {
        if (!this.socket) return;

        this.socket.emit(BookEvents.LIST_SUBSCRIPTIONS);
    }

    /**
     * Re-inscreve em todas as rooms após reconexão
     */
    private resubscribeAll(): void {
        console.log('🔄 Re-inscrevendo em rooms após reconexão...');

        this.subscribedBooks.forEach(bookId => {
            this.socket?.emit(BookEvents.SUBSCRIBE_BOOK, bookId);
        });

        this.subscribedChapters.forEach(chapterId => {
            this.socket?.emit(BookEvents.SUBSCRIBE_CHAPTER, chapterId);
        });
    }

    /**
     * Observa todos os eventos de um livro específico
     */
    watchBook(bookId: string): Observable<any> {
        // Inscreve automaticamente no livro
        this.subscribeToBook(bookId);

        return new Observable(observer => {
            const subscriptions = [
                this.bookUpdated$.subscribe(event => {
                    if (event.id === bookId) {
                        observer.next({ type: BookEvents.UPDATED, data: event });
                    }
                }),
                this.chaptersUpdated$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: BookEvents.CHAPTERS_UPDATED, data: event });
                    }
                }),
                this.chapterScrapingStarted$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: BookEvents.SCRAPING_STARTED, data: event });
                    }
                }),
                this.chapterScrapingCompleted$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: BookEvents.SCRAPING_COMPLETED, data: event });
                    }
                }),
                this.chapterScrapingFailed$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: BookEvents.SCRAPING_FAILED, data: event });
                    }
                }),
                this.coverProcessed$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: BookEvents.COVER_PROCESSED, data: event });
                    }
                }),
                this.coverSelected$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: BookEvents.COVER_SELECTED, data: event });
                    }
                }),
            ];

            return () => {
                subscriptions.forEach(sub => sub.unsubscribe());
                this.unsubscribeFromBook(bookId);
            };
        });
    }

    /**
     * Observa todos os eventos de um capítulo específico
     */
    watchChapter(chapterId: string, bookId: string): Observable<any> {
        // Inscreve no capítulo E no livro (para eventos gerais)
        this.subscribeToChapter(chapterId);
        this.subscribeToBook(bookId);

        return new Observable(observer => {
            const subscriptions = [
                this.chapterUpdated$.subscribe(event => {
                    if (event.chapter?.id === chapterId) {
                        observer.next({ type: BookEvents.CHAPTER_UPDATED, data: event });
                    }
                }),
                this.chapterScrapingStarted$.subscribe(event => {
                    if (event.chapterId === chapterId) {
                        observer.next({ type: BookEvents.SCRAPING_STARTED, data: event });
                    }
                }),
                this.chapterScrapingCompleted$.subscribe(event => {
                    if (event.chapterId === chapterId) {
                        observer.next({ type: BookEvents.SCRAPING_COMPLETED, data: event });
                    }
                }),
                this.chapterScrapingFailed$.subscribe(event => {
                    if (event.chapterId === chapterId) {
                        observer.next({ type: BookEvents.SCRAPING_FAILED, data: event });
                    }
                }),
            ];

            return () => {
                subscriptions.forEach(sub => sub.unsubscribe());
                this.unsubscribeFromChapter(chapterId);
            };
        });
    }
}
