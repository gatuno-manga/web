import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

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

/**
 * Service para gerenciar conexões WebSocket e receber eventos em tempo real
 * Implementa o padrão Observer no lado do cliente
 */
@Injectable({
    providedIn: 'root'
})
export class BookWebsocketService {
    private socket: Socket | null = null;
    private connected = false;

    private bookCreatedSubject = new Subject<BookEvent>();
    private bookUpdatedSubject = new Subject<BookEvent>();
    private chaptersUpdatedSubject = new Subject<ChapterEvent>();
    private chaptersFixSubject = new Subject<ChapterEvent>();
    private coverProcessedSubject = new Subject<CoverEvent>();
    private coverSelectedSubject = new Subject<CoverEvent>();
    private chapterScrapingStartedSubject = new Subject<ScrapingEvent>();
    private chapterScrapingCompletedSubject = new Subject<ScrapingEvent>();
    private chapterScrapingFailedSubject = new Subject<ScrapingEvent>();

    public bookCreated$ = this.bookCreatedSubject.asObservable();
    public bookUpdated$ = this.bookUpdatedSubject.asObservable();
    public chaptersUpdated$ = this.chaptersUpdatedSubject.asObservable();
    public chaptersFix$ = this.chaptersFixSubject.asObservable();
    public coverProcessed$ = this.coverProcessedSubject.asObservable();
    public coverSelected$ = this.coverSelectedSubject.asObservable();
    public chapterScrapingStarted$ = this.chapterScrapingStartedSubject.asObservable();
    public chapterScrapingCompleted$ = this.chapterScrapingCompletedSubject.asObservable();
    public chapterScrapingFailed$ = this.chapterScrapingFailedSubject.asObservable();

    constructor() {}

    connect(): void {
        if (this.connected) {
            console.log('WebSocket já está conectado');
            return;
        }

        const serverUrl = environment.apiURL.replace('/api', '');

        console.log('Tentando conectar WebSocket em:', `${serverUrl}/books`);

        this.socket = io(`${serverUrl}/books`, {
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
            console.log('✅ WebSocket conectado com sucesso');
            this.connected = true;
        });

        this.socket.on('disconnect', (reason) => {
            console.log('⚠️ WebSocket desconectado. Razão:', reason);
            this.connected = false;
        });

        this.socket.on('connect_error', (error: any) => {
            console.warn('⚠️ Erro de conexão WebSocket (tentando reconectar):', error.message);
        });

        this.socket.on('error', (error: any) => {
            console.error('❌ Erro WebSocket:', error.message);
        });

        this.registerEventListeners();
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            console.log('WebSocket desconectado manualmente');
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    private registerEventListeners(): void {
        if (!this.socket) return;
        this.socket.on('book.created', (data: BookEvent) => {
            console.log('Livro criado:', data);
            this.bookCreatedSubject.next(data);
        });

        this.socket.on('book.updated', (data: BookEvent) => {
            console.log('Livro atualizado:', data);
            this.bookUpdatedSubject.next(data);
        });

        this.socket.on('chapters.updated', (data: ChapterEvent) => {
            console.log('Capítulos atualizados:', data);
            this.chaptersUpdatedSubject.next(data);
        });

        this.socket.on('chapters.fix', (data: ChapterEvent) => {
            console.log('Capítulos para corrigir:', data);
            this.chaptersFixSubject.next(data);
        });

        this.socket.on('cover.processed', (data: CoverEvent) => {
            console.log('Capa processada:', data);
            this.coverProcessedSubject.next(data);
        });

        this.socket.on('cover.selected', (data: CoverEvent) => {
            console.log('Capa selecionada:', data);
            this.coverSelectedSubject.next(data);
        });

        this.socket.on('chapter.scraping.started', (data: ScrapingEvent) => {
            console.log('Scraping de capítulo iniciado:', data);
            this.chapterScrapingStartedSubject.next(data);
        });

        this.socket.on('chapter.scraping.completed', (data: ScrapingEvent) => {
            console.log('Scraping de capítulo completo:', data);
            this.chapterScrapingCompletedSubject.next(data);
        });

        this.socket.on('chapter.scraping.failed', (data: ScrapingEvent) => {
            console.log('Scraping de capítulo falhou:', data);
            this.chapterScrapingFailedSubject.next(data);
        });
    }

    watchBook(bookId: string): Observable<any> {
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
            };
        });
    }
}
