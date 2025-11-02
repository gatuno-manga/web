import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserTokenService } from './user-token.service';

export interface BookEvent {
    id: string;
    title: string;
    type?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ChapterEvent {
    bookId: string;
    chapters?: Array<{
        id: string;
        title: string;
        index: number;
        scrapingStatus: string;
    }>;
    chapter?: {
        id: string;
        title: string;
        index: number;
        scrapingStatus: string;
    };
    chapterIds?: string[];
}

export interface CoverEvent {
    bookId: string;
    coverId: string;
    url?: string;
}

export interface ScrapingEvent {
    chapterId: string;
    bookId: string;
    pagesCount?: number;
    error?: string;
}

export interface SubscriptionResponse {
    type: 'book' | 'chapter';
    id: string;
    success: boolean;
    error?: string;
}

export interface SubscriptionsListResponse {
    books: string[];
    chapters: string[];
    isAdmin: boolean;
}

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

        // Eventos de confirmação
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

        // Eventos de livros
        this.socket.on('book.created', (data: BookEvent) => {
            console.log('📚 Livro criado:', data);
            this.bookCreatedSubject.next(data);
        });

        this.socket.on('book.updated', (data: BookEvent) => {
            console.log('📝 Livro atualizado:', data);
            this.bookUpdatedSubject.next(data);
        });

        // Eventos de capítulos
        this.socket.on('chapters.updated', (data: ChapterEvent) => {
            console.log('📚 Capítulos atualizados:', data);
            this.chaptersUpdatedSubject.next(data);
        });

        this.socket.on('chapter.updated', (data: ChapterEvent) => {
            console.log('📖 Capítulo atualizado:', data);
            this.chapterUpdatedSubject.next(data);
        });

        this.socket.on('chapters.fix', (data: ChapterEvent) => {
            console.log('🔧 Capítulos para corrigir:', data);
            this.chaptersFixSubject.next(data);
        });

        // Eventos de scraping
        this.socket.on('chapter.scraping.started', (data: ScrapingEvent) => {
            console.log('🔄 Scraping iniciado:', data);
            this.chapterScrapingStartedSubject.next(data);
        });

        this.socket.on('chapter.scraping.completed', (data: ScrapingEvent) => {
            console.log('✅ Scraping completo:', data);
            this.chapterScrapingCompletedSubject.next(data);
        });

        this.socket.on('chapter.scraping.failed', (data: ScrapingEvent) => {
            console.error('❌ Scraping falhou:', data);
            this.chapterScrapingFailedSubject.next(data);
        });

        // Eventos de capas
        this.socket.on('cover.processed', (data: CoverEvent) => {
            console.log('🖼️ Capa processada:', data);
            this.coverProcessedSubject.next(data);
        });

        this.socket.on('cover.selected', (data: CoverEvent) => {
            console.log('🎨 Capa selecionada:', data);
            this.coverSelectedSubject.next(data);
        });
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

        this.socket.emit('subscribe:book', bookId);
        this.subscribedBooks.add(bookId);
    }

    /**
     * Cancela inscrição em um livro
     */
    unsubscribeFromBook(bookId: string): void {
        if (!this.socket) return;

        this.socket.emit('unsubscribe:book', bookId);
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

        this.socket.emit('subscribe:chapter', chapterId);
        this.subscribedChapters.add(chapterId);
    }

    /**
     * Cancela inscrição em um capítulo
     */
    unsubscribeFromChapter(chapterId: string): void {
        if (!this.socket) return;

        this.socket.emit('unsubscribe:chapter', chapterId);
        this.subscribedChapters.delete(chapterId);
    }

    /**
     * Lista todas as inscrições atuais
     */
    listSubscriptions(): void {
        if (!this.socket) return;

        this.socket.emit('list:subscriptions');
    }

    /**
     * Re-inscreve em todas as rooms após reconexão
     */
    private resubscribeAll(): void {
        console.log('🔄 Re-inscrevendo em rooms após reconexão...');

        this.subscribedBooks.forEach(bookId => {
            this.socket?.emit('subscribe:book', bookId);
        });

        this.subscribedChapters.forEach(chapterId => {
            this.socket?.emit('subscribe:chapter', chapterId);
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
                        observer.next({ type: 'book.updated', data: event });
                    }
                }),
                this.chaptersUpdated$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: 'chapters.updated', data: event });
                    }
                }),
                this.chapterScrapingStarted$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: 'chapter.scraping.started', data: event });
                    }
                }),
                this.chapterScrapingCompleted$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: 'chapter.scraping.completed', data: event });
                    }
                }),
                this.chapterScrapingFailed$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: 'chapter.scraping.failed', data: event });
                    }
                }),
                this.coverProcessed$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: 'cover.processed', data: event });
                    }
                }),
                this.coverSelected$.subscribe(event => {
                    if (event.bookId === bookId) {
                        observer.next({ type: 'cover.selected', data: event });
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
                        observer.next({ type: 'chapter.updated', data: event });
                    }
                }),
                this.chapterScrapingStarted$.subscribe(event => {
                    if (event.chapterId === chapterId) {
                        observer.next({ type: 'chapter.scraping.started', data: event });
                    }
                }),
                this.chapterScrapingCompleted$.subscribe(event => {
                    if (event.chapterId === chapterId) {
                        observer.next({ type: 'chapter.scraping.completed', data: event });
                    }
                }),
                this.chapterScrapingFailed$.subscribe(event => {
                    if (event.chapterId === chapterId) {
                        observer.next({ type: 'chapter.scraping.failed', data: event });
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
