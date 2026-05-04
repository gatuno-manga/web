import { Injectable, Inject, OnDestroy, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { Subject, firstValueFrom, Subscription, fromEvent, of } from 'rxjs';
import { map, timeout, catchError, take } from 'rxjs/operators';
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
import { BackgroundSyncRegistrationService } from './background-sync-registration.service';

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
	private readonly baseUrl = 'users/me/reading-progress';

	// Estado da conexão usando Signals
	private readonly _connectionState = signal<WebSocketConnectionState>(
		WebSocketConnectionState.DISCONNECTED,
	);
	public readonly connectionState = this._connectionState.asReadonly();

	// Estado da sincronização usando Signals
	private readonly _syncStatus = signal<SyncStatus>({
		connected: false,
		syncing: false,
		lastSyncAt: null,
		pendingChanges: 0,
	});
	public readonly syncStatus = this._syncStatus.asReadonly();

	// Eventos
	private progressSyncedSubject = new Subject<RemoteReadingProgress>();
	private progressDeletedSubject = new Subject<{ chapterId: string }>();
	private errorSubject = new Subject<{ message: string }>();

	// Observables públicos
	public progressSynced$ = this.progressSyncedSubject.asObservable();
	public progressDeleted$ = this.progressDeletedSubject.asObservable();
	public error$ = this.errorSubject.asObservable();

	constructor(
		private http: HttpClient,
		private userTokenService: UserTokenService,
		private localProgressService: ReadingProgressService,
		private networkStatusService: NetworkStatusService,
		private backgroundSyncService: BackgroundSyncRegistrationService,
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
		const currentState = this._connectionState();

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
		this._connectionState.set(newState);
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
			const currentState = this._connectionState();
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

		const currentState = this._connectionState();

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
		const namespaceUrl = buildWebSocketUrl(
			'users/me/reading-progress',
			urlConfig,
		);

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

		this.socket = this.createSocket(namespaceUrl, socketConfig) as Socket<
			ReadingProgressServerToClientEvents,
			ReadingProgressClientToServerEvents
		>;

		this.setupSocketListeners();
	}

	/**
	 * Cria a instância do Socket.io.
	 * Protegido para facilitar a substituição em testes unitários.
	 */
	protected createSocket(url: string, config: any): Socket<any, any> {
		return io(url, config);
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
	async saveProgress(progressData: SaveProgressDto): Promise<void> {
		const { chapterId, bookId, pageIndex } = progressData;

		// Salva localmente primeiro (offline-first)
		await this.localProgressService.saveProgress(
			chapterId,
			bookId,
			pageIndex,
		);

		if (this.socket?.connected) {
			// Envia via WebSocket
			this.socket.emit('progress:update', progressData);
		} else {
			// Adiciona à fila de pendentes em memória
			this.pendingChanges.set(chapterId, progressData);
			this.updateSyncStatus({ pendingChanges: this.pendingChanges.size });

			// Prepara para Background Sync (salva no IndexedDB e registra tag)
			const token = this.userTokenService.accessToken;
			if (token && this.isBrowser) {
				await this.localProgressService.enqueueSync({
					...progressData,
					accessToken: token,
				});

				// Registra o evento de Background Sync no Service Worker
				this.backgroundSyncService
					.register('sync-reading-progress')
					.catch(() => {});
			}

			// Tenta sincronizar via HTTP imediatamente (se houver rede básica mas sem WebSocket)
			this.syncViaHttp(progressData).catch(() => {
				logConnectionEvent(
					this.serviceName,
					'sync',
					'Falha no sync via HTTP. Background Sync agendado.',
					LogLevel.DEBUG,
				);
			});
		}
	}

	/**
	 * Registra o evento de Background Sync no Service Worker
	 * @deprecated Use BackgroundSyncRegistrationService instead
	 */
	private registerBackgroundSync(): void {
		this.backgroundSyncService
			.register('sync-reading-progress')
			.catch(() => {});
	}

	/**
	 * Obtém o progresso de um capítulo (local + remoto)
	 */
	async getProgress(chapterId: string): Promise<ReadingProgress | undefined> {
		// Primeiro tenta obter localmente
		const localProgress =
			await this.localProgressService.getProgress(chapterId);

		if (this.socket?.connected) {
			// Solicita do servidor usando RxJS para gerenciar timeout de forma limpa
			this.socket.emit('progress:chapter', { chapterId });

			try {
				const responseData = await firstValueFrom(
					fromEvent<any>(this.socket as any, 'progress:chapter:response')
						.pipe(
							take(1),
							timeout(3000),
							catchError(() => of({ progress: null })),
						)
				);

				if (responseData.progress) {
					// Compara e retorna o mais recente
					if (
						!localProgress ||
						responseData.progress.pageIndex >=
							localProgress.pageIndex
					) {
						const userId =
							this.localProgressService.getCurrentUserId();
						return this.remoteToLocal(responseData.progress, userId);
					}
				}
			} catch (err) {
				logWebSocketError(this.serviceName, err, 'Erro ao obter progresso remoto');
			}
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
			lastSyncAt: this._syncStatus().lastSyncAt || undefined,
		};

		try {
			const response = await firstValueFrom(
				this.http
					.post<{ data: SyncResponse }>(`${this.baseUrl}/sync`, dto)
					.pipe(map((res) => res.data)),
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

	/**
	 * Configura os listeners do WebSocket, divididos por domínio
	 */
	private setupSocketListeners(): void {
		if (!this.socket) return;

		this.setupConnectionListeners();
		this.setupProgressListeners();
		this.setupErrorListeners();
	}

	private setupConnectionListeners(): void {
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

			// Sincroniza mudanças pendentes e solicita sincronização completa
			this.syncPendingChanges();
			this.syncAll();
		});

		this.socket.on('disconnect', (reason) => {
			logConnectionEvent(
				this.serviceName,
				'disconnected',
				{ reason },
				LogLevel.WARN,
			);

			const currentState = this._connectionState();
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
				logConnectionEvent(
					this.serviceName,
					'reconnect',
					'Token expirado ou inválido - desconectando',
					LogLevel.INFO,
				);
				this.disconnect();
				return;
			}

			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.transitionTo(WebSocketConnectionState.ERROR, errorMessage);
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
	}

	private setupProgressListeners(): void {
		if (!this.socket) return;

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

			if (response.success && response.progress) {
				const progress = response.progress;
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

				for (const progress of data.progress) {
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
	}

	private setupErrorListeners(): void {
		if (!this.socket) return;

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
		const payload = {
			chapterId: progress.chapterId,
			bookId: progress.bookId,
			pageIndex: progress.pageIndex,
			totalPages: progress.totalPages,
			completed: progress.completed,
		};

		try {
			await firstValueFrom(
				this.http
					.post<{ data: RemoteReadingProgress }>(
						this.baseUrl,
						payload,
					)
					.pipe(map((res) => res.data)),
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
				this.http
					.get<{ data: RemoteReadingProgress[] }>(this.baseUrl)
					.pipe(map((res) => res.data)),
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
		this._syncStatus.update((state) => ({
			...state,
			...partial,
		}));
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
