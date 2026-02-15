import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	ReadingProgressService,
	ReadingProgress,
} from './reading-progress.service';
import { ReadingProgressSyncService } from './reading-progress-sync.service';
import { RemoteReadingProgress } from '../models/reading-progress-events.model';
import { UserTokenService } from './user-token.service';
import { jwtDecode } from 'jwt-decode';

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
 *
 * Estratégia:
 * - Offline-first: salva localmente primeiro
 * - Sincroniza automaticamente quando online
 * - Resolve conflitos usando "maior página vence"
 * - Migra dados do guest para usuário logado
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
	private pendingSyncData: {
		chapterId: string;
		bookId: string;
		pageIndex: number;
		totalPages?: number;
		completed?: boolean;
	} | null = null;
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

	// Expõe o status de sincronização
	get syncStatus$() {
		return this.syncService.syncStatus$;
	}

	get progressSynced$() {
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
	 * Local: instantâneo
	 * API: com debounce de 2 segundos
	 *
	 * @param chapterId ID do capítulo
	 * @param bookId ID do livro
	 * @param pageIndex Índice da página atual
	 * @param totalPages Total de páginas do capítulo (opcional)
	 * @param completed Se o capítulo foi concluído (opcional)
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
			this.debounceSyncToApi(
				chapterId,
				bookId,
				safePageIndex,
				totalPages,
				completed,
			);
		}
	}

	/**
	 * Salva o progresso imediatamente (local + API sem debounce)
	 * Usado quando o usuário troca de capítulo
	 */
	async saveProgressImmediate(
		chapterId: string,
		bookId: string,
		pageIndex: number,
		totalPages?: number,
		completed?: boolean,
	): Promise<void> {
		if (!this.isBrowser) return;

		// Garante que o índice da página nunca seja negativo
		const safePageIndex = Math.max(0, pageIndex);

		// Cancela qualquer sync pendente
		this.cancelPendingSync();

		// Salva localmente
		await this.localService.saveProgress(chapterId, bookId, safePageIndex);

		// Sincroniza imediatamente se autenticado
		if (this.userTokenService.hasValidAccessToken) {
			await this.syncService.saveProgress(
				chapterId,
				bookId,
				safePageIndex,
				totalPages,
				completed,
			);
		}
	}

	/**
	 * Agenda a sincronização com a API usando debounce
	 */
	private debounceSyncToApi(
		chapterId: string,
		bookId: string,
		pageIndex: number,
		totalPages?: number,
		completed?: boolean,
	): void {
		// Atualiza os dados pendentes
		this.pendingSyncData = {
			chapterId,
			bookId,
			pageIndex,
			totalPages,
			completed,
		};

		// Cancela o timeout anterior
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
		}

		// Agenda novo sync
		this.syncTimeout = setTimeout(async () => {
			if (this.pendingSyncData) {
				await this.syncService.saveProgress(
					this.pendingSyncData.chapterId,
					this.pendingSyncData.bookId,
					this.pendingSyncData.pageIndex,
					this.pendingSyncData.totalPages,
					this.pendingSyncData.completed,
				);
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
	 * Combina dados locais e remotos, priorizando o mais recente
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
	 * Usado para o botão "Continue lendo"
	 */
	async getLastProgressForBook(
		bookId: string,
	): Promise<ReadingProgress | undefined> {
		if (!this.isBrowser) return undefined;

		// Por enquanto, usa apenas o local service
		// TODO: Adicionar busca no servidor se autenticado
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
	 * Conecta ao serviço de sincronização (se autenticado)
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
	 * Chamado quando o usuário faz login para enviar o progresso
	 * que foi salvo enquanto estava deslogado
	 */
	async syncLocalHistoryToServer(): Promise<void> {
		if (!this.isBrowser || !this.userTokenService.hasValidAccessToken) {
			console.log(
				'⚠️ Não é possível sincronizar: usuário não autenticado',
			);
			return;
		}

		try {
			// Obtém todo o histórico local
			const localProgress = await this.localService.getAllProgress();

			if (localProgress.length === 0) {
				console.log('📭 Nenhum progresso local para sincronizar');
				return;
			}

			console.log(
				`📤 Sincronizando ${localProgress.length} itens de progresso local em lote...`,
			);

			// Converte para o formato de DTO esperado pela API
			const progressDtos = localProgress.map((p) => ({
				chapterId: p.chapterId,
				bookId: p.bookId,
				pageIndex: Math.max(0, p.pageIndex),
				timestamp: Date.now(),
				// totalPages e completed podem ser inferidos ou omitidos se não disponíveis
			}));

			// Envia todos os progressos em uma única chamada
			await this.syncService.uploadProgress(progressDtos);

			console.log(
				'✅ Histórico local sincronizado com o servidor com sucesso',
			);
		} catch (error) {
			console.error(
				'❌ Erro ao sincronizar histórico local em lote:',
				error,
			);
		}
	}

	/**
	 * Chamado após o login para sincronizar dados
	 * Combina o histórico local com o remoto
	 */
	async onUserLogin(): Promise<void> {
		if (!this.isBrowser) return;

		const userId = this.extractUserIdFromToken();
		if (!userId) {
			console.error(
				'❌ Não foi possível extrair o ID do usuário do token',
			);
			return;
		}

		console.log(`🔐 Usuário ${userId} logado, iniciando sincronização...`);

		// Define o usuário atual no serviço local
		this.localService.setCurrentUser(userId);

		// Migra os progressos do guest para o usuário
		await this.localService.migrateGuestProgressToUser(userId);

		// Sincroniza o histórico local para o servidor
		await this.syncLocalHistoryToServer();

		// Conecta ao WebSocket para sincronização em tempo real
		this.connect();

		// Sincroniza todos os dados (local ← remoto)
		await this.syncAll();

		console.log('✅ Sincronização pós-login concluída');
	}

	/**
	 * Chamado após o logout para limpar estado
	 */
	onUserLogout(): void {
		if (!this.isBrowser) return;

		console.log('🚪 Usuário deslogado, resetando estado...');

		// Cancela sincronizações pendentes
		this.cancelPendingSync();

		// Desconecta do WebSocket
		this.disconnect();

		// Volta para o usuário guest
		this.localService.setCurrentUser(null);

		console.log('✅ Estado resetado para guest');
	}

	// ==================== MÉTODOS PRIVADOS ====================

	private setupSyncListener(): void {
		if (!this.isBrowser) return;

		// Escuta mudanças remotas e atualiza local
		this.syncService.progressSynced$
			.pipe(takeUntil(this.destroy$))
			.subscribe(async (remoteProgress: RemoteReadingProgress) => {
				// Atualiza progresso local com dados remotos
				await this.localService.saveProgress(
					remoteProgress.chapterId,
					remoteProgress.bookId,
					remoteProgress.pageIndex,
				);
			});

		// Escuta deleções remotas
		this.syncService.progressDeleted$
			.pipe(takeUntil(this.destroy$))
			.subscribe(async (data: { chapterId: string }) => {
				await this.localService.deleteProgress(data.chapterId);
			});
	}
}
