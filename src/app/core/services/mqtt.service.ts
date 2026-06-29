import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, inject, OnDestroy, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BookEvents } from '@constants/book-events.constants';
import { ENVIRONMENT, Environment } from '@core/tokens/environment.token';
import { WINDOW } from '@core/tokens/window.token';
import {
	BookEvent,
	ChapterEvent,
	CoverEvent,
	NewChaptersEvent,
	ScrapingEvent,
	UpdateCompletedEvent,
	UpdateFailedEvent,
	UpdateStartedEvent,
} from '@models/book-events.model';
import { SyncResponse } from '@models/reading-progress-events.model';
import {
	isValidTransition,
	WebSocketConnectionState,
} from '@models/websocket-state.model';
import {
	LogLevel,
	logConnectionEvent,
	logStateTransition,
	logWebSocketError,
} from '@shared/utils/websocket-logger.utils';
import mqtt, { MqttClient } from 'mqtt';
import { Observable, Subject, Subscription } from 'rxjs';
import { NetworkStatusService } from './network-status.service';
import { NotificationService } from './notification.service';
import { NotificationSettingsService } from './notification-settings.service';
import { UserTokenService } from './user-token.service';

export type MqttPayloadData =
	| BookEvent
	| ChapterEvent
	| CoverEvent
	| NewChaptersEvent
	| ScrapingEvent
	| UpdateCompletedEvent
	| UpdateFailedEvent
	| UpdateStartedEvent
	| SyncResponse
	| object
	| string
	| number
	| boolean
	| null;

export interface MqttPayload {
	event: string;
	payload: MqttPayloadData;
}

interface NotificationPayload {
	title?: string;
	message?: string;
	type?: string;
}

export interface MqttWatchEvent {
	type: string;
	data: MqttPayloadData;
}

@Injectable({
	providedIn: 'root',
})
export class MqttService implements OnDestroy {
	private http = inject(HttpClient);
	private client: MqttClient | null = null;

	private readonly _connected = signal<boolean>(false);
	private readonly _connectionState = signal<WebSocketConnectionState>(
		WebSocketConnectionState.DISCONNECTED,
	);

	public readonly connected = this._connected.asReadonly();
	public readonly connectionState = this._connectionState.asReadonly();

	private subscribedTopics = new Set<string>();
	private networkSubscription: Subscription | null = null;
	private readonly serviceName = 'MqttService';
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
	private progressSyncedSubject = new Subject<SyncResponse>();
	private progressDeletedSubject = new Subject<any>();
	private bookLikedSubject = new Subject<any>();
	private bookUnlikedSubject = new Subject<any>();
	private bookDeletedSubject = new Subject<any>();
	private chapterDeletedSubject = new Subject<any>();
	private commentCreatedSubject = new Subject<any>();
	private commentDeletedSubject = new Subject<any>();
	private errorSubject = new Subject<{ message: string }>();

	// Observables públicos
	public readonly connected$ = toObservable(this._connected);
	public readonly connectionState$ = toObservable(this._connectionState);

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
	public progressSynced$ = this.progressSyncedSubject.asObservable();
	public progressDeleted$ = this.progressDeletedSubject.asObservable();
	public bookLiked$ = this.bookLikedSubject.asObservable();
	public bookUnliked$ = this.bookUnlikedSubject.asObservable();
	public bookDeleted$ = this.bookDeletedSubject.asObservable();
	public chapterDeleted$ = this.chapterDeletedSubject.asObservable();
	public commentCreated$ = this.commentCreatedSubject.asObservable();
	public commentDeleted$ = this.commentDeletedSubject.asObservable();
	public error$ = this.errorSubject.asObservable();

	constructor(
		private userTokenService: UserTokenService,
		private networkStatusService: NetworkStatusService,
		private notificationService: NotificationService,
		private notificationSettings: NotificationSettingsService,
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

	private transitionTo(
		newState: WebSocketConnectionState,
		reason?: string,
	): void {
		const currentState = this._connectionState();
		if (currentState === newState) return;

		if (!isValidTransition(currentState, newState)) {
			logWebSocketError(
				this.serviceName,
				new Error(`Transição inválida: ${currentState} → ${newState}`),
				'State machine violation',
			);
			return;
		}

		logStateTransition(this.serviceName, currentState, newState, reason);
		this._connectionState.set(newState);
	}

	private setupNetworkListener(): void {
		this.networkSubscription =
			this.networkStatusService.wentOffline$.subscribe(() => {
				logConnectionEvent(
					this.serviceName,
					'offline',
					'Rede offline - pausando MQTT',
					LogLevel.INFO,
				);
				this.disconnectForOffline();
			});

		this.networkStatusService.wentOnline$.subscribe(() => {
			if (
				this._connectionState() ===
				WebSocketConnectionState.OFFLINE_PAUSED
			) {
				logConnectionEvent(
					this.serviceName,
					'online',
					'Rede online - reconectando MQTT',
					LogLevel.INFO,
				);
				this.connect();
			}
		});
	}

	private disconnectForOffline(): void {
		if (this.client) {
			this.client.end(true);
			this.client = null;
			this.transitionTo(
				WebSocketConnectionState.OFFLINE_PAUSED,
				'Rede offline',
			);
			this._connected.set(false);
		}
	}

	connect(): void {
		if (!this.isBrowser) return;

		const currentState = this._connectionState();
		if (
			currentState === WebSocketConnectionState.CONNECTED ||
			currentState === WebSocketConnectionState.CONNECTING
		) {
			return;
		}

		const token = this.userTokenService.accessToken;
		if (!token) {
			this.transitionTo(
				WebSocketConnectionState.DISCONNECTED,
				'Token não encontrado',
			);
			return;
		}

		this.transitionTo(
			WebSocketConnectionState.CONNECTING,
			'Iniciando conexão MQTT',
		);

		const brokerUrl =
			this.env.mqttBrokerUrl ||
			`ws://${this.window.location?.hostname || 'localhost'}:8083/mqtt`;

		const userId = this.userTokenService.userIdSignal();

		this.client = mqtt.connect(brokerUrl, {
			protocolId: 'MQTT',
			protocolVersion: 4,
			clientId: `gatuno_web_${Math.random().toString(16).substring(2, 8)}`,
			username: userId || 'gatuno-user',
			password: token,
			protocol: 'ws',
			keepalive: 5,
			clean: true,
			reconnectPeriod: 5000,
		});

		this.setupClientListeners();
	}

	private setupClientListeners(): void {
		if (!this.client) return;

		this.client.on('connect', () => {
			logConnectionEvent(
				this.serviceName,
				'connected',
				'MQTT conectado',
				LogLevel.INFO,
			);
			this.transitionTo(
				WebSocketConnectionState.CONNECTED,
				'MQTT conectado com sucesso',
			);
			this._connected.set(true);
			this.resubscribeAll();

			// Assinar tópicos globais dinamicamente via API
			const userId = this.userTokenService.userIdSignal();
			if (userId) {
				console.log(
					`[MQTT_DEBUG] Buscando tópicos dinâmicos na API...`,
				);
				this.http
					.get<{ data: { topics: string[] } }>(
						'/interactions/mqtt-topics',
					)
					.subscribe({
						next: (response) => {
							const topics = response.data?.topics;
							console.log(
								'[MQTT_DEBUG] Tópicos retornados pela API:',
								topics,
							);
							if (topics && Array.isArray(topics)) {
								topics.forEach((topic) => {
									this.subscribeTopic(topic);
								});
							}
						},
						error: (err) => {
							console.error(
								'[MQTT_DEBUG] Falha ao buscar tópicos dinâmicos:',
								err,
							);
						},
					});
			} else {
				console.warn(
					`[MQTT_DEBUG] ⚠️ Nenhum UserID encontrado, pulando requisição de tópicos!`,
				);
			}
		});

		this.client.on('message', (topic, payload) => {
			this.handleMessage(topic, payload.toString());
		});

		this.client.on('close', () => {
			if (
				this._connectionState() !==
				WebSocketConnectionState.OFFLINE_PAUSED
			) {
				this.transitionTo(
					WebSocketConnectionState.DISCONNECTED,
					'MQTT desconectado',
				);
			}
			this._connected.set(false);
		});

		this.client.on('error', (err) => {
			logWebSocketError(this.serviceName, err, 'Erro MQTT');
			this.errorSubject.next({ message: err.message });
			this.transitionTo(WebSocketConnectionState.ERROR, err.message);
		});

		this.client.on('reconnect', () => {
			this.transitionTo(
				WebSocketConnectionState.RECONNECTING,
				'Tentativa de reconexão MQTT',
			);
		});
	}

	private handleMessage(topic: string, messageStr: string): void {
		console.log(
			`[MQTT_DEBUG] 📥 MENSAGEM RECEBIDA | Tópico: [${topic}] | Conteúdo:`,
			messageStr,
		);
		try {
			const parsed = JSON.parse(messageStr);
			// Extrai o dado real caso venha empacotado (ex: NestJS Microservices envia { pattern: "...", data: { ... } })
			const data = (parsed.data ? parsed.data : parsed) as MqttPayload;

			// Lógica de notificação pessoal
			if (topic.includes('/notifications')) {
				if (!this.notificationSettings.enableAllNotifications()) {
					console.log(
						'[MQTT_DEBUG] 🚫 Notificação ignorada pois o usuário desativou nas configurações.',
					);
					return;
				}

				const eventName = data.event;
				const notification = data.payload as any;

				let type: 'info' | 'success' | 'warning' | 'error' = 'info';
				if (eventName === 'book_request.approved') type = 'success';
				if (eventName === 'book_request.rejected') type = 'error';
				if (eventName === 'system.alert') type = 'info';

				this.notificationService.addHistory({
					title: notification.title || 'Sistema',
					message: notification.message || 'Nova notificação',
					type: type,
				});

				this.notificationService.show(
					notification.message || 'Nova notificação',
					type,
				);
				return;
			}

			// Roteamento de eventos Book
			switch (data.event) {
				case BookEvents.CREATED:
					this.bookCreatedSubject.next(data.payload as BookEvent);
					break;
				case BookEvents.UPDATED:
				case 'book.updated':
					this.bookUpdatedSubject.next(data.payload as BookEvent);
					break;
				case BookEvents.NEW_CHAPTERS:
					this.bookNewChaptersSubject.next(
						data.payload as NewChaptersEvent,
					);
					break;
				case BookEvents.UPDATE_STARTED:
					this.bookUpdateStartedSubject.next(
						data.payload as UpdateStartedEvent,
					);
					break;
				case BookEvents.UPDATE_COMPLETED:
					this.bookUpdateCompletedSubject.next(
						data.payload as UpdateCompletedEvent,
					);
					break;
				case BookEvents.UPDATE_FAILED:
					this.bookUpdateFailedSubject.next(
						data.payload as UpdateFailedEvent,
					);
					break;
				case BookEvents.CHAPTERS_UPDATED:
					this.chaptersUpdatedSubject.next(
						data.payload as ChapterEvent,
					);
					break;
				case BookEvents.CHAPTER_UPDATED:
					this.chapterUpdatedSubject.next(
						data.payload as ChapterEvent,
					);
					break;
				case BookEvents.CHAPTERS_FIX:
					this.chaptersFixSubject.next(data.payload as ChapterEvent);
					break;
				case BookEvents.SCRAPING_STARTED:
				case 'chapter.scraping.started':
					this.chapterScrapingStartedSubject.next(
						data.payload as ScrapingEvent,
					);
					break;
				case BookEvents.SCRAPING_COMPLETED:
					this.chapterScrapingCompletedSubject.next(
						data.payload as ScrapingEvent,
					);
					break;
				case BookEvents.SCRAPING_FAILED:
					this.chapterScrapingFailedSubject.next(
						data.payload as ScrapingEvent,
					);
					break;
				case BookEvents.COVER_PROCESSED:
					this.coverProcessedSubject.next(data.payload as CoverEvent);
					break;
				case BookEvents.COVER_SELECTED:
					this.coverSelectedSubject.next(data.payload as CoverEvent);
					break;
				case 'book.deleted':
					this.bookDeletedSubject.next(data.payload);
					break;
				case 'book.liked':
					this.bookLikedSubject.next(data.payload);
					break;
				case 'book.unliked':
					this.bookUnlikedSubject.next(data.payload);
					break;
				case 'chapter.deleted':
					this.chapterDeletedSubject.next(data.payload);
					break;
				case 'comment.created':
					this.commentCreatedSubject.next(data.payload);
					break;
				case 'comment.deleted':
					this.commentDeletedSubject.next(data.payload);
					break;
				// Progresso pessoal
				case 'progress:synced':
					this.progressSyncedSubject.next(
						data.payload as SyncResponse,
					);
					break;
				case 'progress:deleted':
					this.progressDeletedSubject.next(data.payload);
					break;
			}
		} catch (e) {
			console.error('Falha ao parsear payload MQTT', e);
		}
	}

	disconnect(): void {
		if (this.client) {
			this.client.end(true);
			this.client = null;
			this.transitionTo(
				WebSocketConnectionState.DISCONNECTED,
				'Desconexão manual',
			);
			this._connected.set(false);
			this.subscribedTopics.clear();
		}
	}

	isConnected(): boolean {
		return this._connected();
	}

	private subscribeTopic(topic: string): void {
		// Adiciona ao set de tópicos desejados imediatamente.
		// Assim, quando conectar, o resubscribeAll() inscreverá nele.
		this.subscribedTopics.add(topic);

		if (!this.client || !this._connected()) {
			console.warn(
				`[MQTT_DEBUG] ⏳ Cliente offline/conectando. Inscrição salva em fila para o tópico: ${topic}`,
			);
			return;
		}

		this.client.subscribe(topic, { qos: 1 }, (err) => {
			if (!err) {
				console.log(
					`[MQTT_DEBUG] ✅ INSCRIÇÃO CONFIRMADA no tópico: ${topic}`,
				);
				logConnectionEvent(
					this.serviceName,
					'subscribe',
					`Inscrito no tópico: ${topic}`,
					LogLevel.DEBUG,
				);
			} else {
				logWebSocketError(
					this.serviceName,
					err,
					`Falha ao inscrever: ${topic}`,
				);
			}
		});
	}

	private unsubscribeTopic(topic: string): void {
		// Remove do set imediatamente
		this.subscribedTopics.delete(topic);

		if (!this.client || !this._connected()) return;

		this.client.unsubscribe(topic);
	}

	private resubscribeAll(): void {
		for (const topic of this.subscribedTopics) {
			this.subscribeTopic(topic);
		}
	}

	watchBook(bookId: string): Observable<MqttWatchEvent> {
		const topic = `books/events/book/${bookId}`;
		this.subscribeTopic(topic);

		return new Observable((observer) => {
			const subscriptions = [
				this.bookUpdated$.subscribe((event) => {
					if (event.id === bookId)
						observer.next({
							type: BookEvents.UPDATED,
							data: event,
						});
				}),
				this.chaptersUpdated$.subscribe((event) => {
					if (event.bookId === bookId)
						observer.next({
							type: BookEvents.CHAPTERS_UPDATED,
							data: event,
						});
				}),
				this.chapterScrapingStarted$.subscribe((event) => {
					if (event.bookId === bookId)
						observer.next({
							type: BookEvents.SCRAPING_STARTED,
							data: event,
						});
				}),
				this.chapterScrapingCompleted$.subscribe((event) => {
					if (event.bookId === bookId)
						observer.next({
							type: BookEvents.SCRAPING_COMPLETED,
							data: event,
						});
				}),
				this.chapterScrapingFailed$.subscribe((event) => {
					if (event.bookId === bookId)
						observer.next({
							type: BookEvents.SCRAPING_FAILED,
							data: event,
						});
				}),
				this.coverProcessed$.subscribe((event) => {
					if (event.bookId === bookId)
						observer.next({
							type: BookEvents.COVER_PROCESSED,
							data: event,
						});
				}),
				this.coverSelected$.subscribe((event) => {
					if (event.bookId === bookId)
						observer.next({
							type: BookEvents.COVER_SELECTED,
							data: event,
						});
				}),
			];

			return () => {
				subscriptions.forEach((sub) => {
					sub.unsubscribe();
				});
				this.unsubscribeTopic(topic);
			};
		});
	}

	watchChapter(
		chapterId: string,
		bookId: string,
	): Observable<MqttWatchEvent> {
		const chapterTopic = `books/events/chapter/${chapterId}`;
		const bookTopic = `books/events/book/${bookId}`;

		this.subscribeTopic(chapterTopic);
		this.subscribeTopic(bookTopic);

		return new Observable((observer) => {
			const subscriptions = [
				this.chapterUpdated$.subscribe((event) => {
					if (event.chapter?.id === chapterId)
						observer.next({
							type: BookEvents.CHAPTER_UPDATED,
							data: event,
						});
				}),
				this.chapterScrapingStarted$.subscribe((event) => {
					if (event.chapterId === chapterId)
						observer.next({
							type: BookEvents.SCRAPING_STARTED,
							data: event,
						});
				}),
				this.chapterScrapingCompleted$.subscribe((event) => {
					if (event.chapterId === chapterId)
						observer.next({
							type: BookEvents.SCRAPING_COMPLETED,
							data: event,
						});
				}),
				this.chapterScrapingFailed$.subscribe((event) => {
					if (event.chapterId === chapterId)
						observer.next({
							type: BookEvents.SCRAPING_FAILED,
							data: event,
						});
				}),
			];

			return () => {
				subscriptions.forEach((sub) => {
					sub.unsubscribe();
				});
				this.unsubscribeTopic(chapterTopic);
				// Não damos unsubscribe do bookTopic porque ele pode estar sendo usado por watchBook simultaneamente,
				// idealmente haveria um ref count por tópico.
			};
		});
	}
}
