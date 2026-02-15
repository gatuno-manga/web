import { Injectable, Inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject, firstValueFrom, Subscription } from 'rxjs';
import { ENVIRONMENT, Environment } from '../tokens/environment.token';
import { WINDOW } from '../tokens/window.token';
import { UserTokenService } from './user-token.service';
import {
	ReadingProgressService,
	ReadingProgress,
} from './reading-progress.service';
import { NetworkStatusService } from './network-status.service';
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
import {
	RemoteReadingProgress,
	SaveProgressDto,
	SyncConflict,
	SyncResponse,
	SyncReadingProgressDto,
	ReadingProgressServerToClientEvents,
	ReadingProgressClientToServerEvents,
} from '../models/reading-progress-events.model';

export interface SyncStatus {
	connected: boolean;
	syncing: boolean;
	lastSyncAt: Date | null;
	pendingChanges: number;
}

/**
 * Service para sincronização de progresso de leitura com o backend via WebSocket
 *
 * Features:
 * - Sincronização em tempo real via WebSocket
 * - Fallback para HTTP quando WebSocket não disponível
 * - Queue de mudanças pendentes para sincronização offline
 * - Sincronização entre múltiplos dispositivos
 * - Resolução automática de conflitos (maior página vence)
 */
@Injectable({
	providedIn: 'root',
})
export class ReadingProgressSyncService implements OnDestroy {
	private socket: Socket<
		ReadingProgressServerToClientEvents,
		ReadingProgressClientToServerEvents
	> | null = null;
	private isBrowser: boolean;
	private pendingChanges: Map<string, SaveProgressDto> = new Map();
	private syncSubscription: Subscription | null = null;
	private networkSubscription: Subscription | null = null;
	private readonly serviceName = 'ReadingProgressSync';

	// Estado da conexão
	private connectionStateSubject =
		new BehaviorSubject<WebSocketConnectionState>(
			WebSocketConnectionState.DISCONNECTED,
		);

	// Estado da sincronização
	private syncStatusSubject = new BehaviorSubject<SyncStatus>({
		connected: false,
		syncing: false,
		lastSyncAt: null,
		pendingChanges: 0,
	});

	// Eventos
	private progressSyncedSubject = new Subject<RemoteReadingProgress>();
	private progressDeletedSubject = new Subject<{ chapterId: string }>();
	private errorSubject = new Subject<{ message: string }>();

	// Observables públicos
	public connectionState$ = this.connectionStateSubject.asObservable();
	public syncStatus$ = this.syncStatusSubject.asObservable();
	public progressSynced$ = this.progressSyncedSubject.asObservable();
	public progressDeleted$ = this.progressDeletedSubject.asObservable();
	public error$ = this.errorSubject.asObservable();

	constructor(
		private http: HttpClient,
		private userTokenService: UserTokenService,
		private localProgressService: ReadingProgressService,
		private networkStatusService: NetworkStatusService,
		@Inject(ENVIRONMENT) private env: Environment,
		@Inject(WINDOW) private window: Window,
	) {
		this.isBrowser = typeof this.window.location !== 'undefined';

		if (this.isBrowser) {
			// Escuta mudanças de autenticação
			this.setupAuthListener();
			// Escuta mudanças de rede
			this.setupNetworkListener();
		}
	}

	ngOnDestroy(): void {
		this.disconnect();
		this.syncSubscription?.unsubscribe();
		this.networkSubscription?.unsubscribe();
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
	 * Escuta mudanças de rede para desconectar quando offline
	 */
	private setupNetworkListener(): void {
		// Desconecta quando perde a conexão
		this.networkSubscription =
			this.networkStatusService.wentOffline$.subscribe(() => {
				logConnectionEvent(
					this.serviceName,
					'offline',
					'Rede offline - pausando WebSocket de sincronização',
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
					'Rede online - reconectando WebSocket de sincronização',
					LogLevel.INFO,
				);
				this.connect();
			}
		});
	}

	/**
	 * Desconecta o WebSocket quando fica offline
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
			this.updateSyncStatus({ connected: false });
		}
	}

	/**
	 * Conecta ao WebSocket de sincronização
	 */
	connect(): void {
		if (!this.isBrowser) return;

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
			logConnectionEvent(
				this.serviceName,
				'connect',
				'Token não disponível. Sincronização não iniciada.',
				LogLevel.WARN,
			);
			return;
		}

		this.transitionTo(
			WebSocketConnectionState.CONNECTING,
			'Iniciando conexão de sincronização',
		);

		// Constrói a URL usando o utilitário centralizado
		const urlConfig: UrlConfig = {
			isBrowser: this.isBrowser,
			apiUrl: this.env.apiURL,
			apiUrlServer: this.env.apiURLServer,
			origin: this.window.location?.origin,
		};
		const namespaceUrl = buildWebSocketUrl('reading-progress', urlConfig);

		logConnectionEvent(
			this.serviceName,
			'connecting',
			{ url: namespaceUrl },
			LogLevel.DEBUG,
		);

		// Obtém configuração padronizada do Socket.io (com 10 tentativas)
		const socketConfig = getSocketConfig(token, {
			reconnectionAttempts: 10,
		});

		this.socket = io(namespaceUrl, socketConfig) as Socket<
			ReadingProgressServerToClientEvents,
			ReadingProgressClientToServerEvents
		>;

		this.setupSocketListeners();
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
			this.updateSyncStatus({ connected: false });
			logConnectionEvent(
				this.serviceName,
				'disconnect',
				'WebSocket de sincronização desconectado',
				LogLevel.INFO,
			);
		}
	}

	/**
	 * Verifica se está conectado
	 */
	isConnected(): boolean {
		return this.socket?.connected ?? false;
	}

	/**
	 * Salva e sincroniza o progresso de leitura
	 */
	async saveProgress(
		chapterId: string,
		bookId: string,
		pageIndex: number,
		totalPages?: number,
		completed?: boolean,
	): Promise<void> {
		// Salva localmente primeiro (offline-first)
		await this.localProgressService.saveProgress(
			chapterId,
			bookId,
			pageIndex,
		);

		const progressData: SaveProgressDto = {
			chapterId,
			bookId,
			pageIndex,
			timestamp: Date.now(),
			totalPages,
			completed,
		};

		if (this.socket?.connected) {
			// Envia via WebSocket
			this.socket.emit('progress:update', progressData);
		} else {
			// Adiciona à fila de pendentes
			this.pendingChanges.set(chapterId, progressData);
			this.updateSyncStatus({ pendingChanges: this.pendingChanges.size });

			// Tenta sincronizar via HTTP
			this.syncViaHttp(progressData);
		}
	}

	/**
	 * Obtém o progresso de um capítulo (local + remoto)
	 */
	async getProgress(chapterId: string): Promise<ReadingProgress | undefined> {
		// Primeiro tenta obter localmente
		const localProgress =
			await this.localProgressService.getProgress(chapterId);

		if (this.socket?.connected) {
			// Solicita do servidor
			return new Promise((resolve) => {
				this.socket?.emit('progress:chapter', { chapterId });

				const timeout = setTimeout(() => {
					resolve(localProgress);
				}, 3000);

				this.socket?.once(
					'progress:chapter:response',
					(data: {
						chapterId: string;
						progress: RemoteReadingProgress | null;
					}) => {
						clearTimeout(timeout);
						if (data.progress) {
							// Compara e retorna o mais recente
							if (
								!localProgress ||
								data.progress.pageIndex >=
									localProgress.pageIndex
							) {
								const userId =
									this.localProgressService.getCurrentUserId();
								resolve(
									this.remoteToLocal(data.progress, userId),
								);
							} else {
								resolve(localProgress);
							}
						} else {
							resolve(localProgress);
						}
					},
				);
			});
		}

		return localProgress;
	}

	/**
	 * Sincroniza todo o progresso com o servidor
	 */
	async syncAll(): Promise<void> {
		if (!this.isBrowser) return;

		this.updateSyncStatus({ syncing: true });

		try {
			if (this.socket?.connected) {
				// Solicita sincronização completa via WebSocket
				this.socket.emit('progress:sync');
			} else {
				// Fallback para HTTP
				await this.syncAllViaHttp();
			}
		} catch (error) {
			logWebSocketError(this.serviceName, error, 'Erro na sincronização');
			this.errorSubject.next({ message: 'Falha na sincronização' });
		} finally {
			this.updateSyncStatus({ syncing: false });
		}
	}

	/**
	 * Sincroniza mudanças pendentes
	 */
	async syncPendingChanges(): Promise<void> {
		if (this.pendingChanges.size === 0) return;

		const pendingArray = Array.from(this.pendingChanges.values());

		for (const progress of pendingArray) {
			try {
				if (this.socket?.connected) {
					this.socket.emit('progress:update', progress);
				} else {
					await this.syncViaHttp(progress);
				}
				this.pendingChanges.delete(progress.chapterId);
			} catch (error) {
				logWebSocketError(
					this.serviceName,
					error,
					`Erro ao sincronizar ${progress.chapterId}`,
				);
			}
		}

		this.updateSyncStatus({ pendingChanges: this.pendingChanges.size });
	}

	/**
	 * Sincroniza uma lista de progressos em lote com o servidor
	 */
	async uploadProgress(progress: SaveProgressDto[]): Promise<void> {
		if (progress.length === 0) return;

		try {
			await this.syncBulkViaHttp(progress);
			// Remove da lista de pendentes os itens que foram sincronizados
			for (const item of progress) {
				this.pendingChanges.delete(item.chapterId);
			}
			this.updateSyncStatus({
				pendingChanges: this.pendingChanges.size,
				lastSyncAt: new Date(),
			});
		} catch (error) {
			logWebSocketError(
				this.serviceName,
				error,
				'Erro ao sincronizar progresso em lote',
			);
			throw error;
		}
	}

	// ==================== MÉTODOS PRIVADOS ====================

	private async syncBulkViaHttp(
		progress: SaveProgressDto[],
	): Promise<SyncResponse> {
		const dto: SyncReadingProgressDto = {
			progress,
			lastSyncAt: this.syncStatusSubject.value.lastSyncAt || undefined,
		};

		try {
			const response = await firstValueFrom(
				this.http.post<SyncResponse>('reading-progress/sync', dto),
			);
			logConnectionEvent(
				this.serviceName,
				'event',
				`${progress.length} itens sincronizados em lote via HTTP`,
				LogLevel.DEBUG,
			);
			return response;
		} catch (error) {
			logWebSocketError(
				this.serviceName,
				error,
				'Erro na sincronização em lote via HTTP',
			);
			throw error;
		}
	}

	private setupSocketListeners(): void {
		if (!this.socket) return;

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
			this.updateSyncStatus({ connected: true });

			// Sincroniza mudanças pendentes
			this.syncPendingChanges();

			// Solicita sincronização completa
			this.syncAll();
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

			this.updateSyncStatus({ connected: false });
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

			this.transitionTo(WebSocketConnectionState.ERROR, error.message);
			this.updateSyncStatus({ connected: false });
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

		this.socket.on(
			'connected',
			(data: { message: string; userId: string }) => {
				logConnectionEvent(
					this.serviceName,
					'event',
					`Conectado ao serviço: ${data.message}`,
					LogLevel.DEBUG,
				);
			},
		);

		// Progresso salvo com sucesso
		this.socket.on('progress:saved', (progress: RemoteReadingProgress) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				`Progresso salvo no servidor: ${progress.chapterId}`,
				LogLevel.DEBUG,
			);
			this.pendingChanges.delete(progress.chapterId);
			this.updateSyncStatus({
				pendingChanges: this.pendingChanges.size,
				lastSyncAt: new Date(),
			});
		});

		// Progresso sincronizado de outro dispositivo
		this.socket.on('progress:synced', async (response: SyncResponse) => {
			logConnectionEvent(
				this.serviceName,
				'event',
				'Resposta de sincronização recebida',
				LogLevel.DEBUG,
			);

			// O servidor pode retornar progresso sincronizado ou conflitos
			if (response.success && response.progress) {
				const progress = response.progress;
				// Atualiza localmente
				await this.localProgressService.saveProgress(
					progress.chapterId,
					progress.bookId,
					progress.pageIndex,
				);

				this.progressSyncedSubject.next(progress);
			}

			if (response.conflict) {
				logConnectionEvent(
					this.serviceName,
					'event',
					'Conflito de sincronização detectado',
					LogLevel.WARN,
				);
				// Conflito pode ser tratado aqui ou via observable
			}
		});

		// Sincronização completa recebida
		this.socket.on(
			'progress:sync:complete',
			async (data: {
				progress: RemoteReadingProgress[];
				syncedAt: Date;
			}) => {
				logConnectionEvent(
					this.serviceName,
					'event',
					`Sincronização completa recebida: ${data.progress.length} itens`,
					LogLevel.INFO,
				);

				// Atualiza todos os itens localmente
				for (const progress of data.progress) {
					const localProgress =
						await this.localProgressService.getProgress(
							progress.chapterId,
						);

					// Só atualiza se o remoto for mais recente
					if (
						!localProgress ||
						progress.pageIndex >= localProgress.pageIndex
					) {
						await this.localProgressService.saveProgress(
							progress.chapterId,
							progress.bookId,
							progress.pageIndex,
						);
					}
				}

				this.updateSyncStatus({
					syncing: false,
					lastSyncAt: new Date(data.syncedAt),
				});
			},
		);

		// Progresso deletado
		this.socket.on(
			'progress:deleted',
			async (data: { chapterId: string }) => {
				logConnectionEvent(
					this.serviceName,
					'event',
					`Progresso deletado: ${data.chapterId}`,
					LogLevel.DEBUG,
				);
				await this.localProgressService.deleteProgress(data.chapterId);
				this.progressDeletedSubject.next(data);
			},
		);

		// Erros
		this.socket.on('error', (error: { message: string }) => {
			logWebSocketError(
				this.serviceName,
				new Error(error.message),
				'Erro do servidor',
			);
			this.errorSubject.next(error);
		});
	}

	private async syncViaHttp(progress: SaveProgressDto): Promise<void> {
		try {
			await firstValueFrom(
				this.http.post<RemoteReadingProgress>(
					'reading-progress',
					progress,
				),
			);
			logConnectionEvent(
				this.serviceName,
				'event',
				`Progresso sincronizado via HTTP: ${progress.chapterId}`,
				LogLevel.DEBUG,
			);
		} catch (error) {
			logWebSocketError(
				this.serviceName,
				error,
				'Erro ao sincronizar via HTTP',
			);
			throw error;
		}
	}

	private async syncAllViaHttp(): Promise<void> {
		try {
			const remoteProgress = await firstValueFrom(
				this.http.get<RemoteReadingProgress[]>('reading-progress'),
			);

			for (const progress of remoteProgress) {
				const localProgress =
					await this.localProgressService.getProgress(
						progress.chapterId,
					);

				if (
					!localProgress ||
					progress.pageIndex >= localProgress.pageIndex
				) {
					await this.localProgressService.saveProgress(
						progress.chapterId,
						progress.bookId,
						progress.pageIndex,
					);
				}
			}

			this.updateSyncStatus({ lastSyncAt: new Date() });
			logConnectionEvent(
				this.serviceName,
				'event',
				`Sincronização HTTP completa: ${remoteProgress.length} itens`,
				LogLevel.INFO,
			);
		} catch (error) {
			logWebSocketError(
				this.serviceName,
				error,
				'Erro na sincronização HTTP',
			);
			throw error;
		}
	}

	private setupAuthListener(): void {
		// Verifica se há token válido ao inicializar
		if (this.userTokenService.hasValidAccessToken) {
			setTimeout(() => this.connect(), 500);
		}
	}

	private updateSyncStatus(partial: Partial<SyncStatus>): void {
		this.syncStatusSubject.next({
			...this.syncStatusSubject.value,
			...partial,
		});
	}

	private remoteToLocal(
		remote: RemoteReadingProgress,
		userId: string,
	): ReadingProgress {
		return {
			id: `${userId}_${remote.chapterId}`,
			chapterId: remote.chapterId,
			bookId: remote.bookId,
			userId: userId,
			pageIndex: remote.pageIndex,
			updatedAt: remote.updatedAt
				? new Date(remote.updatedAt)
				: new Date(),
		};
	}
}
