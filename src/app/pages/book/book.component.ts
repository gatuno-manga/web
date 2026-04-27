import {
	Component,
	signal,
	OnInit,
	OnDestroy,
	inject,
	NgZone,
	ChangeDetectorRef,
	ChangeDetectionStrategy,
	computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
	BookBasic,
	Chapterlist,
	ScrapingStatus,
} from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { IconsComponent } from '../../components/icons/icons.component';
import { NgOptimizedImage } from '@angular/common';
import { MetaDataService } from '../../service/meta-data.service';
import { UserTokenService } from '../../service/user-token.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { InfoBookComponent } from '../../components/info-book/info-book.component';
import { AsideComponent } from '../../components/aside/aside.component';
import { ButtonComponent } from '../../components/inputs/button/button.component';
import { BlurhashComponent } from '../../components/blurhash/blurhash.component';
import { MarkdownComponent } from 'ngx-markdown';
import { BookWebsocketService } from '../../service/book-websocket.service';
import { DownloadService } from '../../service/download.service';
import { DownloadManagerService } from '../../service/download-manager.service';
import { UnifiedReadingProgressService } from '../../service/unified-reading-progress.service';
import { ChapterService } from '../../service/chapter.service';
import { Subscription, firstValueFrom } from 'rxjs';

import { NotificationService } from '../../service/notification.service';
import { NotificationSeverity } from '../../service/notification/notification-strategy.interface';
import {
	BookDownloadModalComponent,
	BookDownloadResult,
} from '../../components/notification/custom-components/book-download-modal/book-download-modal.component';

@Component({
	selector: 'app-book',
	imports: [
		RouterModule,
		IconsComponent,
		InfoBookComponent,
		AsideComponent,
		ButtonComponent,
		MarkdownComponent,
		NgOptimizedImage,
		BlurhashComponent,
	],
	templateUrl: './book.component.html',
	styleUrl: './book.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(document:click)': 'onDocumentClick()',
	},
})
export class BookComponent implements OnInit, OnDestroy {
	ScrapingStatus = ScrapingStatus;
	book = signal<BookBasic | undefined>(undefined);
	private userTokenService = inject(UserTokenService);
	admin = computed(() => this.userTokenService.isAdminSignal());
	isLoading = signal(true);
	isImageLoaded = signal(false);
	private wsSubscription?: Subscription;
	private coverUrl?: string;

	onImageLoad() {
		this.isImageLoaded.set(true);
	}

	// Estado para "Continue lendo"
	lastReadChapterId: string | null = null;
	lastReadPage = 0;
	firstChapterId: string | null = null;
	private sortedChapters: Chapterlist[] = [];

	// Estado para dropdown de opções
	showOptionsDropdown = signal(false);

	// Estado para verificar se o livro está baixado
	isBookDownloaded = signal(false);

	// Estado para erro de imagem de capa
	coverImageError = false;

	private metaService = inject(MetaDataService);
	private modalService = inject(ModalNotificationService);
	private notificationService = inject(NotificationService);
	private ngZone = inject(NgZone);
	private cdr = inject(ChangeDetectorRef);
	private bookService = inject(BookService);
	private activatedRoute = inject(ActivatedRoute);
	private router = inject(Router);
	private wsService = inject(BookWebsocketService);
	private downloadService = inject(DownloadService);
	private readingProgressService = inject(UnifiedReadingProgressService);
	private chapterService = inject(ChapterService);

	onDocumentClick() {
		this.closeOptionsDropdown();
	}

	onCoverImageError() {
		this.coverImageError = true;
	}

	ngOnInit() {
		const id = this.activatedRoute.snapshot.paramMap.get('id');
		if (!id) {
			this.router.navigate(['../'], { relativeTo: this.activatedRoute });
			return;
		}

		this.bookService.getBook(id).subscribe({
			next: (book) => {
				if (!book) {
					this.router.navigate(['../'], {
						relativeTo: this.activatedRoute,
					});
					return;
				}
				this.book.set(book);
				this.setMetaData();
				this.isLoading.set(false);

				// Verifica se o livro está baixado
				this.checkBookDownloaded();

				// Carrega o último progresso de leitura
				this.loadLastReadingProgress();

				// Conecta ao WebSocket apenas se autenticado
				if (this.userTokenService.hasValidAccessTokenSignal()) {
					this.setupWebSocket(book.id);
				}
			},
			error: async () => {
				try {
					const offlineBook = await this.downloadService.getBook(id);
					if (offlineBook) {
						if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
						this.coverUrl = URL.createObjectURL(offlineBook.cover);

						this.book.set({
							id: offlineBook.id,
							title: offlineBook.title,
							cover: this.coverUrl,
							description: offlineBook.description,
							publication: offlineBook.publication,
							scrapingStatus: ScrapingStatus.READY,
							autoUpdate: false,
							tags: offlineBook.tags,
							sensitiveContent: offlineBook.sensitiveContent,
							totalChapters: offlineBook.totalChapters,
							authors: offlineBook.authors || [],
							blurHash: offlineBook.blurHash,
							dominantColor: offlineBook.dominantColor,
						});
						this.isLoading.set(false);
						this.setMetaData();

						// Tenta carregar capítulos offline para habilitar "Começar a ler"
						this.loadOfflineChapters();
					} else {
						this.router.navigate(['../'], {
							relativeTo: this.activatedRoute,
						});
					}
				} catch (e) {
					this.router.navigate(['../'], {
						relativeTo: this.activatedRoute,
					});
				}
			},
		});
	}

	private async loadOfflineChapters() {
		try {
			const bookId = this.book()?.id;
			if (!bookId) return;

			const offlineChapters =
				await this.downloadService.getChaptersByBook(bookId);
			if (offlineChapters && offlineChapters.length > 0) {
				const chapters: Chapterlist[] = offlineChapters.map((oc) => ({
					id: oc.id,
					title: oc.title,
					index: oc.index,
					originalUrl: '',
					scrapingStatus: ScrapingStatus.READY,
					read: false,
				}));

				this.sortedChapters = [...chapters].sort(
					(a, b) => a.index - b.index,
				);
				this.firstChapterId = this.sortedChapters[0].id;
			}
		} catch (error) {
			console.error('Erro ao carregar capítulos offline:', error);
		}
	}

	ngOnDestroy() {
		// Limpa a inscrição do WebSocket
		this.wsSubscription?.unsubscribe();
		const bookId = this.book()?.id;
		if (bookId) {
			this.wsService.unsubscribeFromBook(bookId);
		}
		if (this.coverUrl) {
			URL.revokeObjectURL(this.coverUrl);
		}
	}

	private setupWebSocket(bookId: string) {
		// Conecta se ainda não estiver conectado
		if (!this.wsService.isConnected()) {
			this.wsService.connect();
		}

		// Observa eventos do livro
		this.wsSubscription = this.wsService
			.watchBook(bookId)
			.subscribe((event) => {
				const typedEvent = event as { type: string; data: unknown };
				console.log(
					'📡 Evento recebido:',
					typedEvent.type,
					typedEvent.data,
				);

				switch (typedEvent.type) {
					case 'book.updated':
						// Atualiza informações do livro
						this.book.update((b) =>
							b
								? {
										...b,
										title: (
											typedEvent.data as { title: string }
										).title,
									}
								: b,
						);
						console.log('✅ Livro atualizado em tempo real');
						break;

					case 'chapters.updated':
						// Atualiza capítulos
						console.log('✅ Capítulos atualizados em tempo real');
						// Recarrega o livro para obter os capítulos atualizados
						this.refreshBook();
						break;

					case 'chapter.scraping.started':
						console.log(
							'🔄 Scraping iniciado para capítulo:',
							(typedEvent.data as { chapterId: string })
								.chapterId,
						);
						break;

					case 'chapter.scraping.completed':
						console.log(
							'✅ Scraping completo! Páginas:',
							(typedEvent.data as { pagesCount: number })
								.pagesCount,
						);
						this.refreshBook();
						break;

					case 'chapter.scraping.failed':
						console.error(
							'❌ Scraping falhou:',
							(typedEvent.data as { error: string }).error,
						);
						break;

					case 'cover.selected':
						// Atualiza capa
						this.refreshBook();
						break;
				}
			});
	}

	private refreshBook() {
		const bookId = this.book()?.id;
		if (bookId) {
			this.bookService.getBook(bookId).subscribe({
				next: (book) => {
					if (book) {
						this.book.set(book);
						console.log('♻️ Livro recarregado');
					}
				},
			});
		}
	}

	setMetaData() {
		const b = this.book();
		if (!b) return;
		this.metaService.setMetaData({
			title: b.title,
			description: b.description,
			image: b.cover,
			url: `https://example.com/books/${b.id}`,
		});
	}

	getScrapingStatusClass(status: ScrapingStatus): string {
		switch (status) {
			case ScrapingStatus.READY:
				return 'Pronto';
			case ScrapingStatus.PROCESSING:
				return 'Processando';
			case ScrapingStatus.ERROR:
				return 'error';
			default:
				return '';
		}
	}

	getAuthorNames(): string {
		return (
			this.book()?.authors?.map((author) => author.name).join(', ') || ''
		);
	}
	filterByTag(tagId: string) {
		this.router.navigate(['/books'], { queryParams: { tags: tagId } });
	}
	fixBook() {
		const b = this.book();
		if (b) {
			this.modalService.show(
				'Consertar Livro',
				`Você tem certeza que deseja consertar o livro "${b.title}"?`,
				[
					{
						label: 'Cancelar',
						type: 'primary',
					},
					{
						label: 'Consertar',
						type: 'danger',
						callback: () => {
							this.confirmFixBook();
						},
					},
				],
				'warning',
			);
		}
	}

	confirmFixBook() {
		const bookId = this.book()?.id;
		if (bookId) {
			this.bookService.fixBook(bookId).subscribe(() => {
				this.router.navigate(['../'], {
					relativeTo: this.activatedRoute,
				});
			});
		}
	}

	resetBook() {
		const b = this.book();
		if (b) {
			this.modalService.show(
				'Redefinir Livro',
				`Você tem certeza que deseja redefinir o livro "${b.title}"? Esta ação não pode ser desfeita.`,
				[
					{
						label: 'Cancelar',
						type: 'primary',
					},
					{
						label: 'Redefinir',
						type: 'danger',
						callback: () => {
							this.confirmResetBook();
						},
					},
				],
				'warning',
			);
		}
	}

	confirmResetBook() {
		const bookId = this.book()?.id;
		if (bookId) {
			this.bookService.resetBook(bookId).subscribe(() => {
				this.router.navigate(['../'], {
					relativeTo: this.activatedRoute,
				});
			});
		}
	}

	forceCheckUpdates() {
		const b = this.book();
		if (b) {
			this.modalService.show(
				'Forçar Atualização',
				`Deseja forçar a verificação de atualizações para o livro "${b.title}"? Isso buscará novos capítulos na fonte original.`,
				[
					{
						label: 'Cancelar',
						type: 'primary',
					},
					{
						label: 'Atualizar',
						type: 'danger',
						callback: () => {
							this.confirmForceCheckUpdates();
						},
					},
				],
				'info',
			);
		}
	}

	confirmForceCheckUpdates() {
		const bookId = this.book()?.id;
		if (bookId) {
			this.bookService.checkUpdates(bookId).subscribe({
				next: () => {
					this.modalService.close();
					this.notificationService.success(
						'A verificação de atualizações foi agendada. Novos capítulos aparecerão automaticamente quando encontrados.',
						'Atualização Agendada',
					);
				},
				error: () => {
					this.modalService.close();
					this.notificationService.error(
						'Não foi possível agendar a verificação de atualizações.',
						'Erro',
					);
				},
			});
		}
	}

	toggleAutoUpdate() {
		const b = this.book();
		if (b) {
			const newState = !b.autoUpdate;
			const action = newState ? 'ativar' : 'desativar';
			this.modalService.show(
				`${newState ? 'Ativar' : 'Desativar'} Atualizações Automáticas`,
				`Deseja ${action} as atualizações automáticas para o livro "${b.title}"? ${newState ? 'O sistema verificará novos capítulos periodicamente.' : 'O livro não será mais verificado automaticamente.'}`,
				[
					{
						label: 'Cancelar',
						type: 'primary',
					},
					{
						label: newState ? 'Ativar' : 'Desativar',
						type: newState ? 'primary' : 'danger',
						callback: () => {
							this.confirmToggleAutoUpdate(newState);
						},
					},
				],
				'info',
			);
		}
	}

	confirmToggleAutoUpdate(enabled: boolean) {
		const b = this.book();
		if (b) {
			this.bookService.toggleAutoUpdate(b.id, enabled).subscribe({
				next: (response) => {
					this.modalService.close();
					this.book.update((curr) =>
						curr ? { ...curr, autoUpdate: response.autoUpdate } : curr,
					);
					this.notificationService.success(
						`Atualizações automáticas ${enabled ? 'ativadas' : 'desativadas'} com sucesso.`,
						'Configuração Atualizada',
					);
				},
				error: () => {
					this.modalService.close();
					this.notificationService.error(
						'Não foi possível alterar a configuração de atualizações automáticas.',
						'Erro',
					);
				},
			});
		}
	}

	// ==================== CONTINUE LENDO ====================

	private async loadLastReadingProgress() {
		const bookId = this.book()?.id;
		if (!bookId) return;

		const progress =
			await this.readingProgressService.getLastProgressForBook(bookId);
		if (progress) {
			this.lastReadChapterId = progress.chapterId;
			this.lastReadPage = progress.pageIndex;
		}
	}

	private loadFirstChapter() {
		const bookId = this.book()?.id;
		if (!bookId) return;

		this.bookService.getAllChapters(bookId).subscribe({
			next: (chapters: Chapterlist[]) => {
				if (chapters && chapters.length > 0) {
					// Ordena por índice e guarda a lista
					this.sortedChapters = [...chapters].sort(
						(a, b) => a.index - b.index,
					);
					this.firstChapterId = this.sortedChapters[0].id;
				}
			},
			error: (err) => {
				console.error('Erro ao carregar capítulos:', err);
			},
		});
	}

	async continueReading() {
		if (this.lastReadChapterId) {
			// Verificar se precisa ir para o próximo capítulo
			const targetChapter = await this.getTargetChapter();

			if (targetChapter.goToNext && targetChapter.nextChapterId) {
				// Usuário terminou o capítulo, vai para o próximo
				this.router.navigate([targetChapter.nextChapterId], {
					relativeTo: this.activatedRoute,
				});
			} else if (targetChapter.isLastPage) {
				// Usuário está na última página e não tem próximo capítulo, volta para o início
				this.router.navigate([this.lastReadChapterId], {
					relativeTo: this.activatedRoute,
					queryParams: { page: 0 },
				});
			} else {
				// Continua no capítulo atual
				this.router.navigate([this.lastReadChapterId], {
					relativeTo: this.activatedRoute,
					queryParams: { page: this.lastReadPage },
				});
			}
		} else {
			await this.ensureFirstChapterLoaded();

			if (this.firstChapterId) {
				this.router.navigate([this.firstChapterId], {
					relativeTo: this.activatedRoute,
				});
				return;
			}

			this.modalService.show(
				'Aviso',
				'Este livro ainda não possui capítulos disponíveis.',
				[{ label: 'Ok', type: 'primary' }],
				'info',
			);
		}
	}

	private async ensureFirstChapterLoaded() {
		const b = this.book();
		if (this.firstChapterId || !b) {
			return;
		}

		try {
			const chapters = await firstValueFrom(
				this.bookService.getAllChapters(b.id),
			);

			if (chapters.length > 0) {
				this.sortedChapters = [...chapters].sort(
					(a, b) => a.index - b.index,
				);
				this.firstChapterId = this.sortedChapters[0].id;
			}
		} catch (error) {
			console.error('Erro ao carregar primeiro capítulo:', error);
		}
	}

	private async getTargetChapter(): Promise<{
		goToNext: boolean;
		nextChapterId: string | null;
		isLastPage: boolean;
	}> {
		if (!this.lastReadChapterId) {
			return { goToNext: false, nextChapterId: null, isLastPage: false };
		}

		try {
			// Busca o capítulo atual para saber o total de páginas
			const chapter = await firstValueFrom(
				this.chapterService.getChapter(this.lastReadChapterId),
			);

			if (!chapter) {
				return {
					goToNext: false,
					nextChapterId: null,
					isLastPage: false,
				};
			}

			const totalPages = chapter.pages?.length || 0;
			const isLastPage = this.lastReadPage >= totalPages - 1;

			if (isLastPage && chapter.next) {
				// Usuário está na última página e existe próximo capítulo
				return {
					goToNext: true,
					nextChapterId: chapter.next,
					isLastPage: true,
				};
			}

			// Alternativa: usar a lista de capítulos ordenada
			if (isLastPage && this.sortedChapters.length > 0) {
				const currentIndex = this.sortedChapters.findIndex(
					(c) => c.id === this.lastReadChapterId,
				);
				if (
					currentIndex >= 0 &&
					currentIndex < this.sortedChapters.length - 1
				) {
					return {
						goToNext: true,
						nextChapterId: this.sortedChapters[currentIndex + 1].id,
						isLastPage: true,
					};
				}
			}

			return { goToNext: false, nextChapterId: null, isLastPage };
		} catch (error) {
			console.error('Erro ao verificar capítulo:', error);
			return { goToNext: false, nextChapterId: null, isLastPage: false };
		}
	}

	// ==================== DROPDOWN DE OPÇÕES ====================

	toggleOptionsDropdown() {
		this.showOptionsDropdown.update((v) => !v);
	}

	closeOptionsDropdown() {
		this.showOptionsDropdown.set(false);
	}

	async checkBookDownloaded() {
		const bookId = this.book()?.id;
		if (!bookId) return;
		const isDownloaded = await this.downloadService.isBookDownloaded(bookId);
		this.isBookDownloaded.set(isDownloaded);
	}

	async saveOffline() {
		this.closeOptionsDropdown();

		const b = this.book();
		if (!b) return;

		this.modalService.show(
			'Salvar no App',
			`Deseja salvar todos os capítulos do livro "${b.title}" para leitura offline no app? Isso pode demorar dependendo do número de capítulos.`,
			[
				{
					label: 'Cancelar',
					type: 'secondary',
				},
				{
					label: 'Salvar',
					type: 'primary',
					callback: async () => {
						this.modalService.close();
						await this.startOfflineSaveProcess();
					},
				},
			],
			'info',
		);
	}

	private async startOfflineSaveProcess() {
		const b = this.book();
		if (!b) return;

		try {
			// Buscar lista de capítulos
			const chapters = await firstValueFrom(
				this.bookService.getAllChapters(b.id),
			);

			if (chapters.length === 0) {
				this.modalService.show(
					'Sem capítulos',
					'Este livro não possui capítulos para salvar.',
					[{ label: 'Ok', type: 'primary' }],
					'info',
				);
				return;
			}

			this.notificationService.info(
				`Salvando ${chapters.length} capítulos para leitura offline. Você pode continuar navegando.`,
				'Salvando no app',
			);

			// Função auxiliar para delay
			const delay = (ms: number) =>
				new Promise((resolve) => setTimeout(resolve, ms));

			// Baixar capítulos sequencialmente em segundo plano com intervalo de 1s
			await this.downloadChaptersInBackground(chapters, delay);
		} catch (error) {
			console.error('Erro ao buscar capítulos:', error);
			this.modalService.show(
				'Erro',
				'Não foi possível buscar os capítulos do livro.',
				[{ label: 'Ok', type: 'primary' }],
				'error',
			);
		}
	}

	async downloadFiles() {
		this.closeOptionsDropdown();

		const b = this.book();
		if (!b) return;

		this.modalService.show(
			'Baixar Arquivos',
			`Deseja baixar os capítulos do livro "${b.title}" em formato ZIP (Imagens ou PDF)?`,
			[
				{
					label: 'Cancelar',
					type: 'secondary',
				},
				{
					label: 'Continuar',
					type: 'primary',
					callback: async () => {
						this.modalService.close();
						await this.startDownloadProcess();
					},
				},
			],
			'info',
		);
	}

	private async startDownloadProcess() {
		const b = this.book();
		if (!b) return;

		try {
			// Buscar lista de capítulos
			const chapters = await firstValueFrom(
				this.bookService.getAllChapters(b.id),
			);

			if (chapters.length === 0) {
				this.modalService.show(
					'Sem capítulos',
					'Este livro não possui capítulos para baixar.',
					[{ label: 'Ok', type: 'primary' }],
					'info',
				);
				return;
			}

			// Abrir modal de seleção de formato e capítulos
			this.openDownloadFilesModal(chapters);
		} catch (error) {
			console.error('Erro ao buscar capítulos:', error);
			this.modalService.show(
				'Erro',
				'Não foi possível buscar os capítulos do livro.',
				[{ label: 'Ok', type: 'primary' }],
				'error',
			);
		}
	}

	private openDownloadFilesModal(chapters: Chapterlist[]) {
		const b = this.book();
		if (!b) return;

		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: BookDownloadModalComponent,
			componentData: {
				chapters: chapters.map((ch) => ({
					id: ch.id,
					title: ch.title,
					index: ch.index,
				})),
				bookTitle: b.title,
				close: (result: BookDownloadResult | null) => {
					this.modalService.close();
					if (result) {
						this.processBookDownload(
							result.format,
							result.chapterIds,
							chapters.length,
						);
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	// Injetar o serviço de download manager
	private downloadManager = inject(DownloadManagerService);

	private processBookDownload(
		format: 'images' | 'pdfs',
		selectedChapterIds: string[],
		totalChapters: number,
	) {
		const b = this.book();
		if (!b) return;

		// Se todos selecionados, envia array vazio (otimização)
		const chapterIds =
			selectedChapterIds.length === totalChapters
				? []
				: selectedChapterIds;

		// Usar o DownloadManagerService para download em background
		// O download continua mesmo se o usuário navegar para outra página
		this.downloadManager.startDownload(
			b.id,
			b.title,
			format,
			chapterIds,
		);

		this.notificationService.info(
			'Download iniciado em background. Você pode navegar para outras páginas.',
			'Download iniciado',
		);
	}

	async deleteDownloadedBook() {
		this.closeOptionsDropdown();

		const b = this.book();
		if (!b) return;

		this.modalService.show(
			'Excluir Download',
			`Deseja excluir o livro "${b.title}" dos downloads? Os capítulos baixados serão removidos do seu dispositivo.`,
			[
				{
					label: 'Cancelar',
					type: 'primary',
				},
				{
					label: 'Excluir',
					type: 'danger',
					callback: async () => {
						await this.downloadService.deleteBook(b.id);
						this.isBookDownloaded.set(false);
						this.modalService.close();
						this.notificationService.success(
							'O livro foi removido dos downloads.',
							'Download excluído',
						);
					},
				},
			],
			'warning',
		);
	}

	private async downloadChaptersInBackground(
		chapters: Chapterlist[],
		delay: (ms: number) => Promise<unknown>,
	) {
		const b = this.book();
		if (!b) return;

		let downloadedCount = 0;
		let skippedCount = 0;

		// Filtra capítulos que já foram baixados
		const chaptersToDownload: Chapterlist[] = [];
		for (const ch of chapters) {
			const isDownloaded = await this.downloadService.isChapterDownloaded(
				ch.id,
			);
			if (isDownloaded) {
				skippedCount++;
			} else {
				chaptersToDownload.push(ch);
			}
		}

		if (chaptersToDownload.length === 0) {
			this.isBookDownloaded.set(true);
			this.notificationService.success(
				`Todos os ${skippedCount} capítulos já estavam salvos offline.`,
				'Download concluído',
			);
			return;
		}

		const batchSize = 20;
		for (let i = 0; i < chaptersToDownload.length; i += batchSize) {
			const batch = chaptersToDownload.slice(i, i + batchSize);
			const batchIds = batch.map((ch) => ch.id);

			try {
				// Busca dados de múltiplos capítulos de uma vez (otimizado)
				const fullChapters = await firstValueFrom(
					this.chapterService.getChaptersBatch(batchIds),
				);

				for (const fullChapter of fullChapters) {
					// Baixar capítulo individualmente para salvar no banco local
					await this.downloadService.downloadChapter(
						b,
						fullChapter,
					);
					downloadedCount++;
				}

				// Pequeno delay entre lotes para não sobrecarregar
				if (i + batchSize < chaptersToDownload.length) {
					await delay(500);
				}
			} catch (error) {
				console.error('Erro ao baixar lote de capítulos:', error);
			}
		}

		// Notificar conclusão e atualizar status
		this.isBookDownloaded.set(true);
		this.notificationService.success(
			`${downloadedCount} capítulos baixados de "${b.title}"${skippedCount > 0 ? `, ${skippedCount} já estavam salvos` : ''}.`,
			'Download concluído',
		);
	}

	shareBook() {
		this.closeOptionsDropdown();

		const b = this.book();
		if (!b) return;

		if (navigator.share) {
			navigator
				.share({
					title: b.title,
					text: b.description,
					url: window.location.href,
				})
				.catch(console.error);
		} else {
			// Fallback: copia o link
			navigator.clipboard.writeText(window.location.href).then(() => {
				this.notificationService.success(
					'Link copiado para a área de transferência.',
					'Link copiado',
				);
			});
		}
	}
}
