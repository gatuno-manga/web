import { Injectable, OnDestroy, Inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject, Subscription } from 'rxjs';
import { ENVIRONMENT, Environment } from '../tokens/environment.token';
import { WINDOW } from '../tokens/window.token';
import { UserTokenService } from './user-token.service';
import { NetworkStatusService } from './network-status.service';
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
	UpdateStartedEvent,
	ServerToClientEvents,
	ClientToServerEvents,
} from '../models/book-events.model';
import {
	WebSocketConnectionState,
	isValidTransition,
} from '../models/websocket-state.model';
import { buildWebSocketUrl, UrlConfig } from '../utils/api-url.utils';
import { getSocketConfig } from '../utils/socket-config.utils';
import {
	logConnectionEvent,
	logStateTransition,
	logWebSocketError,
	LogLevel,
} from '../utils/websocket-logger.utils';
import { isPlatformBrowser } from '@angular/common';

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
	providedIn: 'root',
})
export class BookWebsocketService implements OnDestroy {
	private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
		null;
	private connectedSubject = new BehaviorSubject<boolean>(false);
	private connectionStateSubject =
		new BehaviorSubject<WebSocketConnectionState>(
			WebSocketConnectionState.DISCONNECTED,
		);
	private subscribedBooks = new Set<string>();
	private subscribedChapters = new Set<string>();
	private networkSubscription: Subscription | null = null;
	private readonly serviceName = 'BookWebsocket';
	private readonly isBrowser: boolean;

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
	public connectionState$ = this.connectionStateSubject.asObservable();
	public bookCreated$ = this.bookCreatedSubject.asObservable();
	public bookUpdated$ = this.bookUpdatedSubject.asObservable();
	public bookNewChapters$ = this.bookNewChaptersSubject.asObservable();
	public bookUpdateStarted$ = this.bookUpdateStartedSubject.asObservable();
	public bookUpdateCompleted$ =
		this.bookUpdateCompletedSubject.asObservable();
	public bookUpdateFailed$ = this.bookUpdateFailedSubject.asObservable();
	public chaptersUpdated$ = this.chaptersUpdatedSubject.asObservable();
	public chapterUpdated$ = this.chapterUpdatedSubject.asObservable();
	public chaptersFix$ = this.chaptersFixSubject.asObservable();
	public coverProcessed$ = this.coverProcessedSubject.asObservable();
	public coverSelected$ = this.coverSelectedSubject.asObservable();
	public chapterScrapingStarted$ =
		this.chapterScrapingStartedSubject.asObservable();
	public chapterScrapingCompleted$ =
		this.chapterScrapingCompletedSubject.asObservable();
	public chapterScrapingFailed$ =
		this.chapterScrapingFailedSubject.asObservable();
	public error$ = this.errorSubject.asObservable();

	constructor(
		private userTokenService: UserTokenService,
		private networkStatusService: NetworkStatusService,
		@Inject(ENVIRONMENT) private env: Environment,
		@Inject(WINDOW) private window: Window,
	) {
		this.isBrowser = typeof this.window.location !== 'undefined';
		this.setupNetworkListener();
	}

	ngOnDestroy(): void {
		this.networkSubscription?.unsubscribe();
		this.disconnect();
	}

	/**
	 * Realiza transição de estado validada pela state machine.
	 *
	 * @param newState - Novo estado desejado
	 * @param reason - Motivo da transição (para logging)
	 */
	private transitionTo(
		newState: WebSocketConnectionState,
		reason?: string,
	): void {
		const currentState = this.connectionStateSubject.value;

		if (currentState === newState) {
			return; // Já está no estado desejado
		}

		if (!isValidTransition(currentState, newState)) {
			logWebSocketError(
				this.serviceName,
				new Error(`Transição inválida: ${currentState} → ${newState}`),
				'State machine violation',
			);
			return;
		}

		logStateTransition(this.serviceName, currentState, newState, reason);
		this.connectionStateSubject.next(newState);
	}

	/**
	 * Escuta mudanças de rede para desconectar/reconectar automaticamente
	 */
	private setupNetworkListener(): void {
		// Desconecta quando perde a conexão
		this.networkSubscription =
			this.networkStatusService.wentOffline$.subscribe(() => {
				logConnectionEvent(
					this.serviceName,
					'offline',
					'Rede offline - pausando WebSocket',
					LogLevel.INFO,
				);
				this.disconnectForOffline();
			});

		// Reconecta automaticamente quando a rede volta
		this.networkStatusService.wentOnline$.subscribe(() => {
			const currentState = this.connectionStateSubject.value;
			if (currentState === WebSocketConnectionState.OFFLINE_PAUSED) {
				logConnectionEvent(
					this.serviceName,
					'online',
					'Rede online - reconectando WebSocket',
					LogLevel.INFO,
				);
				this.connect();
			}
		});
	}

	/**
	 * Desconecta o WebSocket quando fica offline (sem limpar inscrições)
	 */
	private disconnectForOffline(): void {
		if (this.socket) {
			// Desabilita reconexão automática antes de desconectar
			this.socket.io.opts.reconnection = false;
			this.socket.disconnect();
			this.socket = null;
			this.transitionTo(
				WebSocketConnectionState.OFFLINE_PAUSED,
				'Rede offline',
			);
			this.connectedSubject.next(false);
		}
	}

	/**
	 * Conecta ao WebSocket com autenticação JWT
	 */
	connect(): void {
		const currentState = this.connectionStateSubject.value;

		if (
			currentState === WebSocketConnectionState.CONNECTED ||
			currentState === WebSocketConnectionState.CONNECTING
		) {
			logConnectionEvent(
				this.serviceName,
				'connect',
				`Já conectado ou conectando (${currentState})`,
				LogLevel.DEBUG,
			);
			return;
		}

		const token = this.userTokenService.accessToken;
		if (!token) {
			logWebSocketError(
				this.serviceName,
				new Error('Token JWT não encontrado'),
				'Não é possível conectar ao WebSocket',
			);
			this.transitionTo(
				WebSocketConnectionState.ERROR,
				'Token não encontrado',
			);
			return;
		}

		this.transitionTo(
			WebSocketConnectionState.CONNECTING,
			'Iniciando conexão',
		);

		// Constrói a URL usando o utilitário centralizado
		const urlConfig: UrlConfig = {
			isBrowser: this.isBrowser,
			apiUrl: this.env.apiURL,
			apiUrlServer: this.env.apiURLServer,
			origin: this.window.location?.origin,
		};
		const namespaceUrl = buildWebSocketUrl('books', urlConfig);

		logConnectionEvent(
			this.serviceName,
			'connecting',
			{ url: namespaceUrl },
			LogLevel.DEBUG,
		);

		// Obtém configuração padronizada do Socket.io
		const socketConfig = getSocketConfig(token);

		this.socket = io(namespaceUrl, socketConfig) as Socket<
			ServerToClientEvents,
			ClientToServerEvents
		>;

		this.socket.on('connect', () => {
			logConnectionEvent(
				this.serviceName,
				'connected',
				{ socketId: this.socket?.id },
				LogLevel.INFO,
			);
			this.transitionTo(
				WebSocketConnectionState.CONNECTED,
				'Handshake bem-sucedido',
			);
			this.connectedSubject.next(true);
			this.resubscribeAll();
		});

		this.socket.on('disconnect', (reason) => {
			logConnectionEvent(
				this.serviceName,
				'disconnected',
				{ reason },
				LogLevel.WARN,
			);

			const currentState = this.connectionStateSubject.value;
			if (currentState !== WebSocketConnectionState.OFFLINE_PAUSED) {
				this.transitionTo(
					WebSocketConnectionState.DISCONNECTED,
					reason,
				);
			}

			this.connectedSubject.next(false);
		});

		this.socket.on('connect_error', (error: unknown) => {
			const err = error as { message?: string };
			logWebSocketError(this.serviceName, error, 'Erro de conexão');

			// Verifica se é erro de autenticação (token expirado)
			if (
				err.message?.includes('401') ||
				err.message?.includes('unauthorized')
			) {
				const newToken = this.userTokenService.accessToken;
				if (newToken && this.socket) {
					logConnectionEvent(
						this.serviceName,
						'reconnect',
						'Token expirado - desconectando para reconexão',
						LogLevel.INFO,
					);
					// Desconecta e deixa que o usuário reconecte manualmente ou refresh a página
					this.disconnect();
					return;
				}
			}

			this.transitionTo(WebSocketConnectionState.ERROR, err.message);
			this.connectedSubject.next(false);
		});

		this.socket.on('error', (error: unknown) => {
			logWebSocketError(this.serviceName, error, 'Erro do WebSocket');
			this.errorSubject.next(error as { message: string });
		});

		this.socket.io.on('reconnect_attempt', () => {
			logConnectionEvent(
				this.serviceName,
				'reconnecting',
				'Tentando reconectar',
				LogLevel.DEBUG,
			);
			this.transitionTo(
				WebSocketConnectionState.RECONNECTING,
				'Tentativa de reconexão',
			);
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
			this.transitionTo(
				WebSocketConnectionState.DISCONNECTED,
				'Desconexão manual',
			);
			this.connectedSubject.next(false);
			this.subscribedBooks.clear();
			this.subscribedChapters.clear();
			logConnectionEvent(
				this.serviceName,
				'disconnect',
				'WebSocket desconectado',
				LogLevel.INFO,
			);
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

		// --- Eventos de Confirmação ---
		this.socket.on('subscribed', (data: SubscriptionResponse) => {
			if (data.success) {
				logConnectionEvent(
					this.serviceName,
					'subscribe',
					`Inscrito em ${data.type}: ${data.id}`,
					LogLevel.DEBUG,
				);
			} else {
				logWebSocketError(
					this.serviceName,
					new Error(data.error),
					`Falha ao inscrever em ${data.type}: ${data.id}`,
				);
			}
		});

		this.socket.on('unsubscribed', (data: SubscriptionResponse) => {
			if (data.success) {
				logConnectionEvent(
					this.serviceName,
					'unsubscribe',
					`Inscrição cancelada em ${data.type}: ${data.id}`,
					LogLevel.DEBUG,
				);
			}
		});

		this.socket.on('subscriptions', (data: SubscriptionsListResponse) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Minhas inscrições: ${data.books.length} books, ${data.chapters.length} chapters`,
				LogLevel.DEBUG,
			);
		});

		// --- Eventos de Livros ---
		this.socket.on(BookEvents.CREATED, (event: BookEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Livro criado - ${BookEvents.CREATED}`,
				LogLevel.DEBUG,
			);
			this.bookCreatedSubject.next(event);
		});

		this.socket.on(BookEvents.UPDATED, (event: BookEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Livro atualizado - ${BookEvents.UPDATED}`,
				LogLevel.DEBUG,
			);
			this.bookUpdatedSubject.next(event);
		});

		this.socket.on(BookEvents.NEW_CHAPTERS, (event: NewChaptersEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Novos capítulos encontrados - ${BookEvents.NEW_CHAPTERS}`,
				LogLevel.DEBUG,
			);
			this.bookNewChaptersSubject.next(event);
		});

		this.socket.on(
			BookEvents.UPDATE_STARTED,
			(event: UpdateStartedEvent) => {
				logConnectionEvent(
					this.serviceName,
					'event',
					`Atualização iniciada - ${BookEvents.UPDATE_STARTED}`,
					LogLevel.DEBUG,
				);
				this.bookUpdateStartedSubject.next(event);
			},
		);

		this.socket.on(
			BookEvents.UPDATE_COMPLETED,
			(event: UpdateCompletedEvent) => {
				logConnectionEvent(
					this.serviceName,
					'event',
					`Atualização concluída - ${BookEvents.UPDATE_COMPLETED}`,
					LogLevel.DEBUG,
				);
				this.bookUpdateCompletedSubject.next(event);
			},
		);

		this.socket.on(BookEvents.UPDATE_FAILED, (event: UpdateFailedEvent) => {
			logWebSocketError(
				this.serviceName,
				new Error('Atualização falhou'),
				BookEvents.UPDATE_FAILED,
			);
			this.bookUpdateFailedSubject.next(event);
		});

		// --- Eventos de Capítulos ---
		this.socket.on(BookEvents.CHAPTERS_UPDATED, (event: ChapterEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Capítulos atualizados - ${BookEvents.CHAPTERS_UPDATED}`,
				LogLevel.DEBUG,
			);
			this.chaptersUpdatedSubject.next(event);
		});

		this.socket.on(BookEvents.CHAPTER_UPDATED, (event: ChapterEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Capítulo atualizado - ${BookEvents.CHAPTER_UPDATED}`,
				LogLevel.DEBUG,
			);
			this.chapterUpdatedSubject.next(event);
		});

		this.socket.on(BookEvents.CHAPTERS_FIX, (event: ChapterEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Capítulos para corrigir - ${BookEvents.CHAPTERS_FIX}`,
				LogLevel.DEBUG,
			);
			this.chaptersFixSubject.next(event);
		});

		// --- Eventos de Scraping ---
		this.socket.on(BookEvents.SCRAPING_STARTED, (event: ScrapingEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Scraping iniciado - ${BookEvents.SCRAPING_STARTED}`,
				LogLevel.DEBUG,
			);
			this.chapterScrapingStartedSubject.next(event);
		});

		this.socket.on(
			BookEvents.SCRAPING_COMPLETED,
			(event: ScrapingEvent) => {
				logConnectionEvent(
					this.serviceName,
					'event',
					`Scraping completo - ${BookEvents.SCRAPING_COMPLETED}`,
					LogLevel.DEBUG,
				);
				this.chapterScrapingCompletedSubject.next(event);
			},
		);

		this.socket.on(BookEvents.SCRAPING_FAILED, (event: ScrapingEvent) => {
			logWebSocketError(
				this.serviceName,
				new Error('Scraping falhou'),
				BookEvents.SCRAPING_FAILED,
			);
			this.chapterScrapingFailedSubject.next(event);
		});

		// --- Eventos de Capas ---
		this.socket.on(BookEvents.COVER_PROCESSED, (event: CoverEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Capa processada - ${BookEvents.COVER_PROCESSED}`,
				LogLevel.DEBUG,
			);
			this.coverProcessedSubject.next(event);
		});

		this.socket.on(BookEvents.COVER_SELECTED, (event: CoverEvent) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Capa selecionada - ${BookEvents.COVER_SELECTED}`,
				LogLevel.DEBUG,
			);
			this.coverSelectedSubject.next(event);
		});
	}

	// ==================== MÉTODOS DE INSCRIÇÃO ====================

	/**
	 * Inscreve-se em um livro específico
	 */
	subscribeToBook(bookId: string): void {
		if (!this.socket || !this.connectedSubject.value) {
			logConnectionEvent(
				this.serviceName,
				'subscribe',
				`WebSocket não conectado. Não é possível inscrever-se no livro ${bookId}`,
				LogLevel.WARN,
			);
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
			logConnectionEvent(
				this.serviceName,
				'subscribe',
				`WebSocket não conectado. Não é possível inscrever-se no capítulo ${chapterId}`,
				LogLevel.WARN,
			);
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
		const totalBooks = this.subscribedBooks.size;
		const totalChapters = this.subscribedChapters.size;

		if (totalBooks > 0 || totalChapters > 0) {
			logConnectionEvent(
				this.serviceName,
				'reconnect',
				`Re-inscrevendo em ${totalBooks} livros e ${totalChapters} capítulos`,
				LogLevel.INFO,
			);
		}

		for (const bookId of this.subscribedBooks) {
			this.socket?.emit(BookEvents.SUBSCRIBE_BOOK, bookId);
		}

		for (const chapterId of this.subscribedChapters) {
			this.socket?.emit(BookEvents.SUBSCRIBE_CHAPTER, chapterId);
		}
	}

	/**
	 * Observa todos os eventos de um livro específico
	 */
	watchBook(bookId: string): Observable<unknown> {
		// Inscreve automaticamente no livro
		this.subscribeToBook(bookId);

		return new Observable((observer) => {
			const subscriptions = [
				this.bookUpdated$.subscribe((event) => {
					if (event.id === bookId) {
						observer.next({
							type: BookEvents.UPDATED,
							data: event,
						});
					}
				}),
				this.chaptersUpdated$.subscribe((event) => {
					if (event.bookId === bookId) {
						observer.next({
							type: BookEvents.CHAPTERS_UPDATED,
							data: event,
						});
					}
				}),
				this.chapterScrapingStarted$.subscribe((event) => {
					if (event.bookId === bookId) {
						observer.next({
							type: BookEvents.SCRAPING_STARTED,
							data: event,
						});
					}
				}),
				this.chapterScrapingCompleted$.subscribe((event) => {
					if (event.bookId === bookId) {
						observer.next({
							type: BookEvents.SCRAPING_COMPLETED,
							data: event,
						});
					}
				}),
				this.chapterScrapingFailed$.subscribe((event) => {
					if (event.bookId === bookId) {
						observer.next({
							type: BookEvents.SCRAPING_FAILED,
							data: event,
						});
					}
				}),
				this.coverProcessed$.subscribe((event) => {
					if (event.bookId === bookId) {
						observer.next({
							type: BookEvents.COVER_PROCESSED,
							data: event,
						});
					}
				}),
				this.coverSelected$.subscribe((event) => {
					if (event.bookId === bookId) {
						observer.next({
							type: BookEvents.COVER_SELECTED,
							data: event,
						});
					}
				}),
			];

			return () => {
				for (const sub of subscriptions) {
					sub.unsubscribe();
				}
				this.unsubscribeFromBook(bookId);
			};
		});
	}

	/**
	 * Observa todos os eventos de um capítulo específico
	 */
	watchChapter(chapterId: string, bookId: string): Observable<unknown> {
		// Inscreve no capítulo E no livro (para eventos gerais)
		this.subscribeToChapter(chapterId);
		this.subscribeToBook(bookId);

		return new Observable((observer) => {
			const subscriptions = [
				this.chapterUpdated$.subscribe((event) => {
					if (event.chapter?.id === chapterId) {
						observer.next({
							type: BookEvents.CHAPTER_UPDATED,
							data: event,
						});
					}
				}),
				this.chapterScrapingStarted$.subscribe((event) => {
					if (event.chapterId === chapterId) {
						observer.next({
							type: BookEvents.SCRAPING_STARTED,
							data: event,
						});
					}
				}),
				this.chapterScrapingCompleted$.subscribe((event) => {
					if (event.chapterId === chapterId) {
						observer.next({
							type: BookEvents.SCRAPING_COMPLETED,
							data: event,
						});
					}
				}),
				this.chapterScrapingFailed$.subscribe((event) => {
					if (event.chapterId === chapterId) {
						observer.next({
							type: BookEvents.SCRAPING_FAILED,
							data: event,
						});
					}
				}),
			];

			return () => {
				for (const sub of subscriptions) {
					sub.unsubscribe();
				}
				this.unsubscribeFromChapter(chapterId);
			};
		});
	}
}
