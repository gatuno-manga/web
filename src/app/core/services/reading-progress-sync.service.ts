import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, inject, OnDestroy, signal } from '@angular/core';
import { ENVIRONMENT, Environment } from '@core/tokens/environment.token';
import { WINDOW } from '@core/tokens/window.token';
import {
	RemoteReadingProgress,
	SaveProgressDto,
	SyncReadingProgressDto,
	SyncResponse,
} from '@models/reading-progress-events.model';
import {
	LogLevel,
	logConnectionEvent,
	logWebSocketError,
} from '@shared/utils/websocket-logger.utils';
import { firstValueFrom, Subject, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { BackgroundSyncRegistrationService } from './background-sync-registration.service';
import { MqttService } from './mqtt.service';
import { NetworkStatusService } from './network-status.service';
import {
	ReadingProgress,
	ReadingProgressService,
} from './reading-progress.service';
import { UserTokenService } from './user-token.service';

export interface SyncStatus {
	connected: boolean;
	syncing: boolean;
	lastSyncAt: Date | null;
	pendingChanges: number;
}

@Injectable({
	providedIn: 'root',
})
export class ReadingProgressSyncService implements OnDestroy {
	private isBrowser: boolean;
	private pendingChanges: Map<string, SaveProgressDto> = new Map();
	private mqttSubscription: Subscription | null = null;
	private networkSubscription: Subscription | null = null;
	private readonly serviceName = 'ReadingProgressSync';
	private readonly baseUrl = 'users/me/reading-progress';

	private mqttService = inject(MqttService);

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
		@Inject(ENVIRONMENT) _env: Environment,
		@Inject(WINDOW) private window: Window,
	) {
		this.isBrowser = typeof this.window.location !== 'undefined';

		if (this.isBrowser) {
			this.setupNetworkListener();
			this.setupMqttListeners();
		}
	}

	ngOnDestroy(): void {
		this.mqttSubscription?.unsubscribe();
		this.networkSubscription?.unsubscribe();
	}

	private setupNetworkListener(): void {
		this.networkSubscription =
			this.networkStatusService.wentOnline$.subscribe(() => {
				if (this.pendingChanges.size > 0) {
					this.syncPendingChanges();
				}
			});
	}

	private setupMqttListeners(): void {
		this.mqttSubscription = this.mqttService.progressSynced$.subscribe(
			async (response: SyncResponse) => {
				logConnectionEvent(
					this.serviceName,
					'event',
					'Resposta de sincronização recebida via MQTT',
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
			},
		);
	}

	connect(): void {
		if (!this.isBrowser) return;
		this.mqttService.connect();
		this.updateSyncStatus({ connected: true });
	}

	disconnect(): void {
		this.mqttService.disconnect();
		this.updateSyncStatus({ connected: false });
	}

	isConnected(): boolean {
		return this.mqttService.isConnected();
	}

	async saveProgress(progressData: SaveProgressDto): Promise<void> {
		const { chapterId, bookId, pageIndex } = progressData;

		// Salva localmente primeiro (offline-first)
		await this.localProgressService.saveProgress(
			chapterId,
			bookId,
			pageIndex,
		);

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

			this.backgroundSyncService
				.register('sync-reading-progress')
				.catch(() => {});
		}

		// Tenta sincronizar via HTTP imediatamente
		this.syncViaHttp(progressData)
			.then(() => {
				this.pendingChanges.delete(chapterId);
				this.updateSyncStatus({
					pendingChanges: this.pendingChanges.size,
					lastSyncAt: new Date(),
				});
			})
			.catch(() => {
				logConnectionEvent(
					this.serviceName,
					'sync',
					'Falha no sync via HTTP. Background Sync agendado.',
					LogLevel.DEBUG,
				);
			});
	}

	async getProgress(chapterId: string): Promise<ReadingProgress | undefined> {
		return await this.localProgressService.getProgress(chapterId);
	}

	async syncAll(): Promise<void> {
		if (!this.isBrowser) return;

		this.updateSyncStatus({ syncing: true });

		try {
			await this.syncAllViaHttp();
		} catch (error) {
			logWebSocketError(this.serviceName, error, 'Erro na sincronização');
			this.errorSubject.next({ message: 'Falha na sincronização' });
		} finally {
			this.updateSyncStatus({ syncing: false });
		}
	}

	async syncPendingChanges(): Promise<void> {
		if (this.pendingChanges.size === 0) return;

		const pendingArray = Array.from(this.pendingChanges.values());

		for (const progress of pendingArray) {
			try {
				await this.syncViaHttp(progress);
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

	async uploadProgress(progress: SaveProgressDto[]): Promise<void> {
		if (progress.length === 0) return;

		try {
			await this.syncBulkViaHttp(progress);
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

	private updateSyncStatus(partial: Partial<SyncStatus>): void {
		this._syncStatus.update((state) => ({
			...state,
			...partial,
		}));
	}
}
