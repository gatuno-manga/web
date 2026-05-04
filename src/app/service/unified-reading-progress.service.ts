import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	ReadingProgressService,
	ReadingProgress,
} from './reading-progress.service';
import { ReadingProgressSyncService } from './reading-progress-sync.service';
import { RemoteReadingProgress, SaveProgressDto } from '../models/reading-progress-events.model';
import { UserTokenService } from './user-token.service';
import { jwtDecode } from 'jwt-decode';
import { toObservable as signalToObservable } from '@angular/core/rxjs-interop';

interface JwtPayload {
	sub: string;
	[key: string]: unknown;
}

/**
 * Facade para gerenciamento unificado do progresso de leitura
 *
 * Combina:
 * - Armazenamento local (IndexedDB) para acesso offline
 * - Sincronização em tempo real via WebSocket
 * - Fallback HTTP quando WebSocket não disponível
 * - Suporte a múltiplos usuários no mesmo dispositivo
 */
@Injectable({
	providedIn: 'root',
})
export class UnifiedReadingProgressService implements OnDestroy {
	private destroy$ = new Subject<void>();
	private isBrowser: boolean;
	private syncSubscription?: Subscription;

	// Debounce para sincronização com API
	private syncTimeout: ReturnType<typeof setTimeout> | null = null;
	private pendingSyncData: SaveProgressDto | null = null;
	private readonly SYNC_DEBOUNCE_MS = 10000;

	constructor(
		@Inject(PLATFORM_ID) platformId: object,
		private localService: ReadingProgressService,
		private syncService: ReadingProgressSyncService,
		private userTokenService: UserTokenService,
	) {
		this.isBrowser = isPlatformBrowser(platformId);
		this.setupSyncListener();
		this.initializeUser();
	}

	/**
	 * Inicializa o usuário correto baseado no token atual
	 */
	private initializeUser(): void {
		if (!this.isBrowser) return;

		const userId = this.extractUserIdFromToken();
		this.localService.setCurrentUser(userId);
	}

	/**
	 * Extrai o ID do usuário do token JWT
	 */
	private extractUserIdFromToken(): string | null {
		const token = this.userTokenService.accessToken;
		if (!token) return null;

		try {
			const decoded = jwtDecode<JwtPayload>(token);
			return decoded.sub || null;
		} catch {
			return null;
		}
	}

	// Expõe o status de sincronização como sinal (padrão moderno)
	public get syncStatus() {
		return this.syncService.syncStatus;
	}

	// Mantém compatibilidade com observable se necessário
	public get syncStatus$() {
		return signalToObservable(this.syncService.syncStatus);
	}

	public get progressSynced$() {
		return this.syncService.progressSynced$;
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		// Limpa o timeout de sincronização
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
		}
	}

	/**
	 * Salva o progresso de leitura (local + remoto)
	 */
	async saveProgress(
		chapterId: string,
		bookId: string,
		pageIndex: number,
		totalPages?: number,
		completed?: boolean,
	): Promise<void> {
		if (!this.isBrowser) return;

		// Garante que o índice da página nunca seja negativo
		const safePageIndex = Math.max(0, pageIndex);

		// Salva localmente INSTANTANEAMENTE
		await this.localService.saveProgress(chapterId, bookId, safePageIndex);

		// Se usuário está autenticado, sincroniza com DEBOUNCE
		if (this.userTokenService.hasValidAccessToken) {
			this.debounceSyncToApi({
				chapterId,
				bookId,
				pageIndex: safePageIndex,
				timestamp: Date.now(),
				totalPages,
				completed,
			});
		}
	}

	/**
	 * Salva o progresso imediatamente (local + API sem debounce)
	 */
	async saveProgressImmediate(
		chapterId: string,
		bookId: string,
		pageIndex: number,
		totalPages?: number,
		completed?: boolean,
	): Promise<void> {
		if (!this.isBrowser) return;

		const safePageIndex = Math.max(0, pageIndex);

		// Cancela qualquer sync pendente
		this.cancelPendingSync();

		// Salva localmente
		await this.localService.saveProgress(chapterId, bookId, safePageIndex);

		// Sincroniza imediatamente se autenticado
		if (this.userTokenService.hasValidAccessToken) {
			await this.syncService.saveProgress({
				chapterId,
				bookId,
				pageIndex: safePageIndex,
				timestamp: Date.now(),
				totalPages,
				completed,
			});
		}
	}

	/**
	 * Agenda a sincronização com a API usando debounce
	 */
	private debounceSyncToApi(progressData: SaveProgressDto): void {
		// Atualiza os dados pendentes
		this.pendingSyncData = progressData;

		// Cancela o timeout anterior
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
		}

		// Agenda novo sync
		this.syncTimeout = setTimeout(async () => {
			if (this.pendingSyncData) {
				await this.syncService.saveProgress(this.pendingSyncData);
				this.pendingSyncData = null;
			}
		}, this.SYNC_DEBOUNCE_MS);
	}

	/**
	 * Cancela qualquer sincronização pendente
	 */
	cancelPendingSync(): void {
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
			this.syncTimeout = null;
		}
		this.pendingSyncData = null;
	}

	/**
	 * Obtém o progresso de leitura de um capítulo
	 */
	async getProgress(chapterId: string): Promise<ReadingProgress | undefined> {
		if (!this.isBrowser) return undefined;

		// Se usuário está autenticado, tenta obter do servidor
		if (this.userTokenService.hasValidAccessToken) {
			return this.syncService.getProgress(chapterId);
		}

		// Fallback para local
		return this.localService.getProgress(chapterId);
	}

	/**
	 * Obtém o último progresso de leitura de um livro específico
	 */
	async getLastProgressForBook(
		bookId: string,
	): Promise<ReadingProgress | undefined> {
		if (!this.isBrowser) return undefined;
		return this.localService.getLastProgressForBook(bookId);
	}

	/**
	 * Remove o progresso de um capítulo
	 */
	async deleteProgress(chapterId: string): Promise<void> {
		if (!this.isBrowser) return;
		await this.localService.deleteProgress(chapterId);
	}

	/**
	 * Conecta ao serviço de sincronização
	 */
	connect(): void {
		if (!this.isBrowser) return;

		if (this.userTokenService.hasValidAccessToken) {
			this.syncService.connect();
		}
	}

	/**
	 * Desconecta do serviço de sincronização
	 */
	disconnect(): void {
		this.syncService.disconnect();
	}

	/**
	 * Força sincronização completa
	 */
	async syncAll(): Promise<void> {
		if (!this.isBrowser || !this.userTokenService.hasValidAccessToken)
			return;
		await this.syncService.syncAll();
	}

	/**
	 * Verifica se está conectado ao serviço de sincronização
	 */
	isConnected(): boolean {
		return this.syncService.isConnected();
	}

	/**
	 * Sincroniza todo o histórico local com o servidor
	 */
	async syncLocalHistoryToServer(): Promise<void> {
		if (!this.isBrowser || !this.userTokenService.hasValidAccessToken) {
			return;
		}

		try {
			// Obtém todo o histórico local
			const localProgress = await this.localService.getAllProgress();

			if (localProgress.length === 0) {
				return;
			}

			// Converte para o formato de DTO esperado pela API
			const progressDtos: SaveProgressDto[] = localProgress.map((p) => ({
				chapterId: p.chapterId,
				bookId: p.bookId,
				pageIndex: Math.max(0, p.pageIndex),
				timestamp: Date.now(),
			}));

			// Envia todos os progressos em uma única chamada
			await this.syncService.uploadProgress(progressDtos);
		} catch (error) {
			console.error(
				'❌ Erro ao sincronizar histórico local em lote:',
				error,
			);
		}
	}

	/**
	 * Chamado após o login para sincronizar dados
	 */
	async onUserLogin(): Promise<void> {
		if (!this.isBrowser) return;

		const userId = this.extractUserIdFromToken();
		if (!userId) return;

		this.localService.setCurrentUser(userId);
		await this.localService.migrateGuestProgressToUser(userId);
		await this.syncLocalHistoryToServer();
		this.connect();
		await this.syncAll();
	}

	/**
	 * Chamado após o logout para limpar estado
	 */
	onUserLogout(): void {
		if (!this.isBrowser) return;

		this.cancelPendingSync();
		this.disconnect();
		this.localService.setCurrentUser(null);
	}

	// ==================== MÉTODOS PRIVADOS ====================

	private setupSyncListener(): void {
		if (!this.isBrowser) return;

		this.syncService.progressSynced$
			.pipe(takeUntil(this.destroy$))
			.subscribe(async (remoteProgress: RemoteReadingProgress) => {
				await this.localService.saveProgress(
					remoteProgress.chapterId,
					remoteProgress.bookId,
					remoteProgress.pageIndex,
				);
			});

		this.syncService.progressDeleted$
			.pipe(takeUntil(this.destroy$))
			.subscribe(async (data: { chapterId: string }) => {
				await this.localService.deleteProgress(data.chapterId);
			});
	}
}
