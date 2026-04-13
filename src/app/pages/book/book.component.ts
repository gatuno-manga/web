import {
	Component,
	signal,
	OnInit,
	OnDestroy,
	HostListener,
	inject,
	NgZone,
	AfterViewInit,
	ChangeDetectorRef,
	ElementRef,
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
	],
	templateUrl: './book.component.html',
	styleUrl: './book.component.scss',
})
export class BookComponent implements OnInit, OnDestroy, AfterViewInit {
	ScrapingStatus = ScrapingStatus;
	book!: BookBasic;
	admin = false;
	isLoading = signal(true);
	private wsSubscription?: Subscription;
	private coverUrl?: string;

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

	// Largura dinâmica do background (rotacionado)
	backgroundWidth = typeof window !== 'undefined' ? window.innerHeight : 0;
	private resizeObserver?: ResizeObserver;
	private mutationObserver?: MutationObserver;

	private metaService = inject(MetaDataService);
	private modalService = inject(ModalNotificationService);
	private notificationService = inject(NotificationService);
	private userTokenService = inject(UserTokenService);
	private ngZone = inject(NgZone);
	private cdr = inject(ChangeDetectorRef);
	private elRef = inject(ElementRef);

	constructor(
		private bookService: BookService,
		private activatedRoute: ActivatedRoute,
		private router: Router,
		private wsService: BookWebsocketService,
		private downloadService: DownloadService,
		private readingProgressService: UnifiedReadingProgressService,
		private chapterService: ChapterService,
	) {
		this.admin = this.userTokenService.isAdmin;
	}

	@HostListener('document:click')
	onDocumentClick() {
		this.closeOptionsDropdown();
	}

	@HostListener('window:resize')
	updateBackgroundSize() {
		const hostHeight = (this.elRef.nativeElement as HTMLElement)
			.offsetHeight;
		const viewportHeight =
			typeof window !== 'undefined' ? window.innerHeight : 0;
		const newWidth = Math.max(hostHeight, viewportHeight);

		if (this.backgroundWidth !== newWidth) {
			this.backgroundWidth = newWidth;
			this.cdr.detectChanges();
		}
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
				this.book = book;
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

						this.book = {
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
						};
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
			const offlineChapters =
				await this.downloadService.getChaptersByBook(this.book.id);
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

	ngAfterViewInit() {
		this.updateBackgroundSize();
		this.setupObservers();
	}

	ngOnDestroy() {
		// Limpa a inscrição do WebSocket
		this.wsSubscription?.unsubscribe();
		if (this.book) {
			this.wsService.unsubscribeFromBook(this.book.id);
		}
		if (this.coverUrl) {
			URL.revokeObjectURL(this.coverUrl);
		}
		this.resizeObserver?.disconnect();
		this.mutationObserver?.disconnect();
	}

	private setupObservers() {
		if (typeof window === 'undefined') return;

		// ResizeObserver no próprio host para capturar crescimento do conteúdo
		// independente de qual elemento pai faz o scroll
		if (window.ResizeObserver) {
			this.resizeObserver = new ResizeObserver(() => {
				this.ngZone.run(() => this.updateBackgroundSize());
			});
			this.resizeObserver.observe(this.elRef.nativeElement);
		}

		// MutationObserver para detectar mudanças no DOM (ex: @defer carregando)
		this.mutationObserver = new MutationObserver(() => {
			this.ngZone.run(() => this.updateBackgroundSize());
		});

		this.mutationObserver.observe(this.elRef.nativeElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['style', 'class'],
		});
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
						this.book.title = (
							typedEvent.data as { title: string }
						).title;
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
		if (this.book) {
			this.bookService.getBook(this.book.id).subscribe({
				next: (book) => {
					if (book) {
						this.book = book;
						console.log('♻️ Livro recarregado');
					}
				},
			});
		}
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: this.book.title,
			description: this.book.description,
			image: this.book.cover,
			url: `https://example.com/books/${this.book.id}`,
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
		return this.book.authors?.map((author) => author.name).join(', ') || '';
	}
	filterByTag(tagId: string) {
		this.router.navigate(['/books'], { queryParams: { tags: tagId } });
	}
	fixBook() {
		if (this.book) {
			this.modalService.show(
				'Consertar Livro',
				`Você tem certeza que deseja consertar o livro "${this.book.title}"?`,
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
		if (this.book) {
			this.bookService.fixBook(this.book.id).subscribe(() => {
				this.router.navigate(['../'], {
					relativeTo: this.activatedRoute,
				});
			});
		}
	}

	resetBook() {
		if (this.book) {
			this.modalService.show(
				'Redefinir Livro',
				`Você tem certeza que deseja redefinir o livro "${this.book.title}"? Esta ação não pode ser desfeita.`,
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
		if (this.book) {
			this.bookService.resetBook(this.book.id).subscribe(() => {
				this.router.navigate(['../'], {
					relativeTo: this.activatedRoute,
				});
			});
		}
	}

	forceCheckUpdates() {
		if (this.book) {
			this.modalService.show(
				'Forçar Atualização',
				`Deseja forçar a verificação de atualizações para o livro "${this.book.title}"? Isso buscará novos capítulos na fonte original.`,
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
		if (this.book) {
			this.bookService.checkUpdates(this.book.id).subscribe({
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
		if (this.book) {
			const newState = !this.book.autoUpdate;
			const action = newState ? 'ativar' : 'desativar';
			this.modalService.show(
				`${newState ? 'Ativar' : 'Desativar'} Atualizações Automáticas`,
				`Deseja ${action} as atualizações automáticas para o livro "${this.book.title}"? ${newState ? 'O sistema verificará novos capítulos periodicamente.' : 'O livro não será mais verificado automaticamente.'}`,
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
		if (this.book) {
			this.bookService.toggleAutoUpdate(this.book.id, enabled).subscribe({
				next: (response) => {
					this.modalService.close();
					this.book.autoUpdate = response.autoUpdate;
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
		if (!this.book) return;

		const progress =
			await this.readingProgressService.getLastProgressForBook(
				this.book.id,
			);
		if (progress) {
			this.lastReadChapterId = progress.chapterId;
			this.lastReadPage = progress.pageIndex;
		}
	}

	private loadFirstChapter() {
		if (!this.book) return;

		this.bookService.getAllChapters(this.book.id).subscribe({
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
		if (this.firstChapterId || !this.book) {
			return;
		}

		try {
			const chapters = await firstValueFrom(
				this.bookService.getAllChapters(this.book.id),
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
		if (!this.book) return;
		const isDownloaded = await this.downloadService.isBookDownloaded(
			this.book.id,
		);
		this.isBookDownloaded.set(isDownloaded);
	}

	async saveOffline() {
		this.closeOptionsDropdown();

		if (!this.book) return;

		this.modalService.show(
			'Salvar no App',
			`Deseja salvar todos os capítulos do livro "${this.book.title}" para leitura offline no app? Isso pode demorar dependendo do número de capítulos.`,
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
		if (!this.book) return;

		try {
			// Buscar lista de capítulos
			const chapters = await firstValueFrom(
				this.bookService.getAllChapters(this.book.id),
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

		if (!this.book) return;

		this.modalService.show(
			'Baixar Arquivos',
			`Deseja baixar os capítulos do livro "${this.book.title}" em formato ZIP (Imagens ou PDF)?`,
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
		try {
			// Buscar lista de capítulos
			const chapters = await firstValueFrom(
				this.bookService.getAllChapters(this.book.id),
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
				bookTitle: this.book.title,
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
		if (!this.book) return;

		// Se todos selecionados, envia array vazio (otimização)
		const chapterIds =
			selectedChapterIds.length === totalChapters
				? []
				: selectedChapterIds;

		// Usar o DownloadManagerService para download em background
		// O download continua mesmo se o usuário navegar para outra página
		this.downloadManager.startDownload(
			this.book.id,
			this.book.title,
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

		if (!this.book) return;

		this.modalService.show(
			'Excluir Download',
			`Deseja excluir o livro "${this.book.title}" dos downloads? Os capítulos baixados serão removidos do seu dispositivo.`,
			[
				{
					label: 'Cancelar',
					type: 'primary',
				},
				{
					label: 'Excluir',
					type: 'danger',
					callback: async () => {
						await this.downloadService.deleteBook(this.book.id);
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
						this.book,
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
			`${downloadedCount} capítulos baixados de "${this.book.title}"${skippedCount > 0 ? `, ${skippedCount} já estavam salvos` : ''}.`,
			'Download concluído',
		);
	}

	shareBook() {
		this.closeOptionsDropdown();

		if (navigator.share) {
			navigator
				.share({
					title: this.book.title,
					text: this.book.description,
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
