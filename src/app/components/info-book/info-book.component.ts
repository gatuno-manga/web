import {
	Component,
	ElementRef,
	ViewChild,
	AfterViewInit,
	signal,
	OnDestroy,
	inject,
	PLATFORM_ID,
	NgZone,
	ChangeDetectorRef,
	computed,
	input,
	ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { BookService } from '../../service/book.service';
import {
	Book,
	BookBasic,
	BookDetail,
	Chapterlist,
	Cover,
	ScrapingStatus,
	UpdateBookDto,
	ContentType,
	ContentTypes,
} from '../../models/book.models';
import { RouterModule } from '@angular/router';
import { IconsComponent } from '../icons/icons.component';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { Subscription, firstValueFrom, fromEvent, throttleTime } from 'rxjs';
import { DownloadService } from '../../service/download.service';
import { ChapterService } from '../../service/chapter.service';
import { DownloadStatus } from '../../models/offline.models';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { ContextMenuService } from '../../service/context-menu.service';
import { ContextMenuItem } from '../../models/context-menu.models';
import { UserTokenService } from '../../service/user-token.service';
import { ImageViewerComponent } from '../image-viewer/image-viewer.component';
import { SavedPagesService } from '../../service/saved-pages.service';
import { SavedPage } from '../../models/saved-page.models';
import {
	CoverEditModalComponent,
	CoverEditSaveEvent,
} from '../notification/custom-components/cover-edit-modal/cover-edit-modal.component';
import {
	SourceAddModalComponent,
	SourceAddSaveEvent,
} from '../notification/custom-components/source-add-modal/source-add-modal.component';
import { PromptModalComponent } from '../notification/custom-components/prompt-modal/prompt-modal.component';
import { NotificationService } from '../../service/notification.service';
import { NotificationSeverity } from 'app/service/notification';
import {
	CdkDragDrop,
	moveItemInArray,
	DragDropModule,
} from '@angular/cdk/drag-drop';

enum tab {
	chapters = 0,
	covers = 1,
	extraInfo = 2,
	savedPages = 3,
}

interface ModulesLoad {
	load: ReturnType<typeof signal<boolean>>;
	function: () => Promise<void>;
}

@Component({
	selector: 'app-info-book',
	imports: [
		RouterModule,
		DecimalPipe,
		IconsComponent,
		ButtonComponent,
		ImageViewerComponent,
		DragDropModule,
	],
	templateUrl: './info-book.component.html',
	styleUrl: './info-book.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(window:resize)': 'updateContainerHeight()',
	},
})
export class InfoBookComponent implements AfterViewInit, OnDestroy {
	private bookService = inject(BookService);
	private modalService = inject(ModalNotificationService);
	private downloadService = inject(DownloadService);
	private chapterService = inject(ChapterService);
	private contextMenuService = inject(ContextMenuService);
	private savedPagesService = inject(SavedPagesService);
	public userTokenService = inject(UserTokenService);
	private notificationService = inject(NotificationService);
	private platformId = inject(PLATFORM_ID);
	private ngZone = inject(NgZone);
	private cdr = inject(ChangeDetectorRef);
	private resizeObserver?: ResizeObserver;
	private mutationObserver?: MutationObserver;

	tab = tab;
	ScrapingStatus = ScrapingStatus;

	id = input.required<string>();
	bookBasic = input<BookBasic | undefined>();

	selectedTab = signal<tab>(tab.chapters);
	sortAscending = signal(true);

	private websocketSubscription?: Subscription;
	private downloadSubscription?: Subscription;
	private scrollSubscription?: Subscription;

	modulesLoad: ModulesLoad[] = [
		{
			load: signal(false),
			function: async () => this.loadChapters(),
		},
		{
			load: signal(false),
			function: async () => this.loadCovers(),
		},
		{
			load: signal(false),
			function: async () => this.loadExtraInfo(),
		},
		{
			load: signal(false),
			function: async () => this.loadSavedPages(),
		},
	];
	chapters = signal<Chapterlist[]>([]);
	nextChaptersCursor = signal<string | null>(null);
	hasMoreChapters = signal(false);
	isLoadingMoreChapters = signal(false);
	readonly chaptersPageLimit = 200;
	covers = signal<Cover[]>([]);
	originalCovers = signal<Cover[]>([]);
	isReorderingCovers = signal(false);
	hasCoversChanged = signal(false);

	savedPages = signal<SavedPage[]>([]);
	extraInfo = signal<BookDetail>({
		alternativeTitle: [],
		originalUrl: [],
		scrapingStatus: ScrapingStatus.PROCESSING,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	chaptersDownloadStatus = signal<Map<string, DownloadStatus | 'downloaded'>>(
		new Map(),
	);
	chaptersDownloadProgress = signal<Map<string, number>>(new Map());

	// Multi-selection state
	selectedChapters = signal<Set<string>>(new Set());

	// Image viewer state
	showImageViewer = signal(false);
	viewerImageUrl = signal('');
	viewerImageTitle = signal('');
	viewerImageDescription = signal('');

	// Cover edit modal state
	editingCover = signal<Cover | null>(null);

	// Track cover image loading errors
	coverImageErrors = signal<Set<string>>(new Set());

	@ViewChild('selector') selector!: ElementRef<HTMLDivElement>;
	@ViewChild('firstTab') firstTab!: ElementRef<HTMLSpanElement>;
	@ViewChild('container') containerElement!: ElementRef<HTMLDivElement>;

	containerHeight = signal('auto');

	ngAfterViewInit() {
		if (this.firstTab) {
			this.firstTab.nativeElement.click();
		}

		if (isPlatformBrowser(this.platformId)) {
			this.setupResizeObserver();
			this.setupScrollListener();
		}

		this.subscribeToWebSocketEvents();

		this.downloadSubscription =
			this.downloadService.downloadProgress$.subscribe((progressMap) => {
				const statusMap = new Map(this.chaptersDownloadStatus());
				const progressValueMap = new Map(
					this.chaptersDownloadProgress(),
				);

				progressMap.forEach((progress, chapterId) => {
					statusMap.set(chapterId, progress.status);
					if (progress.total > 0) {
						progressValueMap.set(
							chapterId,
							(progress.current / progress.total) * 100,
						);
					}

					if (progress.status === 'completed') {
						statusMap.set(chapterId, 'downloaded');
					}
				});

				this.chaptersDownloadStatus.set(statusMap);
				this.chaptersDownloadProgress.set(progressValueMap);
			});
	}

	ngOnDestroy() {
		this.resizeObserver?.disconnect();
		this.mutationObserver?.disconnect();
		if (this.websocketSubscription) {
			this.websocketSubscription.unsubscribe();
		}
		if (this.downloadSubscription) {
			this.downloadSubscription.unsubscribe();
		}
		if (this.scrollSubscription) {
			this.scrollSubscription.unsubscribe();
		}
	}

	private subscribeToWebSocketEvents() {
		const bookId = this.id();
		if (!bookId) return;

		this.websocketSubscription = this.bookService
			.watchBook(bookId)
			.subscribe({
				next: (event) => {
					const typedEvent = event as { type: string; data: unknown };
					console.log('📡 Evento WebSocket recebido:', typedEvent);

					switch (typedEvent.type) {
						case 'chapters.updated':
							if (
								this.selectedTab() === tab.chapters &&
								this.modulesLoad[tab.chapters].load()
							) {
								this.loadChapters();
							} else {
								this.modulesLoad[tab.chapters].load.set(false);
							}
							break;

						case 'cover.processed':
						case 'cover.selected':
							if (
								this.selectedTab() === tab.covers &&
								this.modulesLoad[tab.covers].load()
							) {
								this.loadCovers();
							} else {
								this.modulesLoad[tab.covers].load.set(false);
							}
							break;

						case 'book.updated':
							if (
								this.selectedTab() === tab.extraInfo &&
								this.modulesLoad[tab.extraInfo].load()
							) {
								this.loadExtraInfo();
							} else {
								this.modulesLoad[tab.extraInfo].load.set(false);
							}
							break;
					}
				},
				error: (error) => {
					console.error('❌ Erro no WebSocket:', error);
				},
			});
	}

	selectTab(tabName: tab, event?: Event) {
		this.selectedTab.set(tabName);
		this.loadResults(tabName);

		if (event && this.selector) {
			const clickedElement = event.target as HTMLSpanElement;
			clickedElement.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'center',
			});
			const headerElement = clickedElement.parentElement;

			if (headerElement) {
				const clickedRect = clickedElement.getBoundingClientRect();
				const headerRect = headerElement.getBoundingClientRect();

				const relativeLeft = clickedRect.left - headerRect.left;
				const width = clickedRect.width;

				const selectorEl = this.selector.nativeElement;
				selectorEl.style.left = `${relativeLeft}px`;
				selectorEl.style.width = `${width}px`;
			}
		}

		// Atualizar altura imediatamente e após animação
		this.observeActiveTab();
	}

	private setupResizeObserver() {
		this.resizeObserver = new ResizeObserver(() => {
			this.ngZone.run(() => this.updateContainerHeight());
		});

		// MutationObserver para detectar quando o conteúdo do @defer é inserido
		this.mutationObserver = new MutationObserver(() => {
			this.ngZone.run(() => this.updateContainerHeight());
		});
	}

	private setupScrollListener() {
		this.scrollSubscription = fromEvent(window, 'scroll', {
			capture: true,
		})
			.pipe(
				throttleTime(100, undefined, {
					leading: true,
					trailing: true,
				}),
			)
			.subscribe(() => this.onWindowScroll());
	}

	private observeActiveTab() {
		if (!this.resizeObserver || !this.mutationObserver) return;

		// Disconnect temporarily to avoid observing multiple elements or wrong one
		this.resizeObserver.disconnect();
		this.mutationObserver.disconnect();

		requestAnimationFrame(() => {
			if (!this.containerElement?.nativeElement) return;

			const tabs =
				this.containerElement.nativeElement.querySelectorAll(
					'.container',
				);
			const activeTab = tabs[this.selectedTab()] as HTMLElement;

			if (activeTab) {
				this.resizeObserver?.observe(activeTab);
				this.mutationObserver?.observe(activeTab, {
					childList: true,
					subtree: true,
					attributes: true,
				});

				// Atualização imediata
				this.updateContainerHeight();

				// Atualizações com delay para garantir que o @defer carregou
				setTimeout(() => this.updateContainerHeight(), 50);
				setTimeout(() => this.updateContainerHeight(), 150);
				setTimeout(() => this.updateContainerHeight(), 300);
			}
		});
	}

	public updateContainerHeight() {
		if (!this.containerElement?.nativeElement) {
			return;
		}

		const container = this.containerElement.nativeElement;
		const tabs = container.querySelectorAll('.container');

		if (tabs.length === 0) {
			return;
		}

		const activeTab = tabs[this.selectedTab()] as HTMLElement;

		if (activeTab) {
			const newHeight = `${activeTab.scrollHeight}px`;
			if (this.containerHeight() !== newHeight) {
				this.containerHeight.set(newHeight);
			}
		}
	}

	private scheduleHeightUpdate() {
		// Aguarda o Angular renderizar o conteúdo e depois atualiza a altura
		requestAnimationFrame(() => {
			this.updateContainerHeight();
			setTimeout(() => this.updateContainerHeight(), 50);
			setTimeout(() => this.updateContainerHeight(), 150);
			setTimeout(() => this.updateContainerHeight(), 500);
		});
	}

	private scheduleLoadMoreCheck() {
		requestAnimationFrame(() => {
			this.onWindowScroll();
			setTimeout(() => this.onWindowScroll(), 50);
			setTimeout(() => this.onWindowScroll(), 150);
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

	getContentTypeIcon(chapter: Chapterlist): string {
		const contentType = chapter.contentType || ContentTypes.IMAGE;
		switch (contentType) {
			case ContentTypes.TEXT:
				return 'book';
			case ContentTypes.DOCUMENT:
				return 'file';
			default:
				return 'image';
		}
	}

	loadResults(index: number) {
		if (this.modulesLoad[index] && !this.modulesLoad[index].load()) {
			this.modulesLoad[index].function();
			this.modulesLoad[index].load.set(true);
		}
	}

	toggleSort() {
		this.sortAscending.update((v) => !v);
		this.loadChapters();
	}

	sortChapters() {
		const asc = this.sortAscending();
		this.chapters.update((currentChapters) => {
			return [...currentChapters].sort((a, b) =>
				asc ? a.index - b.index : b.index - a.index,
			);
		});
	}

	isInitialChaptersLoading = computed(() => {
		return this.isLoadingMoreChapters() && this.chapters().length === 0;
	});

	isAppendingChapters = computed(() => {
		return this.isLoadingMoreChapters() && this.chapters().length > 0;
	});

	loadChapters() {
		this.nextChaptersCursor.set(null);
		this.hasMoreChapters.set(false);
		this.loadChaptersPage();
	}

	loadMoreChapters() {
		const cursor = this.nextChaptersCursor();
		if (!cursor || !this.hasMoreChapters()) {
			return;
		}

		this.loadChaptersPage(cursor, true);
	}

	onWindowScroll() {
		if (
			this.selectedTab() !== tab.chapters ||
			!this.hasMoreChapters() ||
			this.isLoadingMoreChapters() ||
			!this.containerElement?.nativeElement
		) {
			return;
		}

		// Usar o bounding rect do container ATIVO (o que tem o conteúdo)
		const container = this.containerElement.nativeElement;
		const tabs = container.querySelectorAll('.container');
		const activeTab = tabs[this.selectedTab()] as HTMLElement;

		if (!activeTab) {
			return;
		}

		const rect = activeTab.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const thresholdPx = 1000;

		if (rect.bottom <= viewportHeight + thresholdPx) {
			this.loadMoreChapters();
		}
	}

	private loadChaptersPage(cursor?: string, append = false) {
		if (this.isLoadingMoreChapters()) {
			return;
		}

		this.isLoadingMoreChapters.set(true);

		this.bookService
			.getChapters(this.id(), {
				cursor,
				limit: this.chaptersPageLimit,
				order: this.sortAscending() ? 'ASC' : 'DESC',
			})
			.subscribe({
				next: (chapters) => {
					const updatedChapters = append
						? [...this.chapters(), ...chapters.data]
						: chapters.data;

					this.chapters.set(updatedChapters);
					this.nextChaptersCursor.set(chapters.nextCursor);
					this.hasMoreChapters.set(chapters.hasNextPage);
					this.sortChapters();
					this.checkDownloadedChapters();
					this.isLoadingMoreChapters.set(false);
					this.scheduleHeightUpdate();
					this.scheduleLoadMoreCheck();
				},
				error: async (error) => {
					this.isLoadingMoreChapters.set(false);

					if (append) {
						console.error('Error loading chapters page:', error);
						return;
					}

					console.error(
						'Error loading chapters from API, trying offline:',
						error,
					);
					try {
						const offlineChapters =
							await this.downloadService.getChaptersByBook(
								this.id(),
							);
						if (offlineChapters && offlineChapters.length > 0) {
							const mappedChapters = offlineChapters.map(
								(oc) => ({
									id: oc.id,
									title: oc.title,
									index: oc.index,
									originalUrl: '',
									scrapingStatus: ScrapingStatus.READY,
									read: false,
								}),
							);

							this.chapters.set(mappedChapters);
							this.sortChapters();
							this.hasMoreChapters.set(false);
							this.nextChaptersCursor.set(null);

							const statusMap = new Map(
								this.chaptersDownloadStatus(),
							);
							for (const c of mappedChapters) {
								statusMap.set(c.id, 'downloaded');
							}
							this.chaptersDownloadStatus.set(statusMap);
							this.scheduleHeightUpdate();
						}
					} catch (e) {
						console.error('Error loading offline chapters', e);
					}
				},
			});
	}

	async checkDownloadedChapters() {
		const statusMap = new Map(this.chaptersDownloadStatus());
		for (const chapter of this.chapters()) {
			const isDownloaded = await this.downloadService.isChapterDownloaded(
				chapter.id,
			);
			if (isDownloaded) {
				statusMap.set(chapter.id, 'downloaded');
			}
		}
		this.chaptersDownloadStatus.set(statusMap);
	}

	async downloadChapter(
		chapterList: Chapterlist,
		event?: Event,
	): Promise<void> {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}

		if (
			this.chaptersDownloadStatus().get(chapterList.id) ===
				'downloaded' ||
			this.chaptersDownloadStatus().get(chapterList.id) === 'downloading'
		) {
			return;
		}

		const basicInfo = this.bookBasic();
		if (!basicInfo) {
			console.error('Book basic info not available');
			return;
		}

		try {
			// Fetch full chapter details first
			const fullChapter = await firstValueFrom(
				this.chapterService.getChapter(chapterList.id),
			);

			// Fetch full book details
			const fullBookBasic = await firstValueFrom(
				this.bookService.getBook(this.id()),
			);

			const bookToSave = fullBookBasic as unknown as Book;
			await this.downloadService.downloadChapter(bookToSave, fullChapter);
		} catch (e) {
			console.error('Download failed', e);
		}
	}

	async deleteChapterDownload(chapter: Chapterlist, event?: Event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}

		this.modalService.show(
			'Excluir Download',
			`Deseja excluir o capítulo ${chapter.index}${chapter.title ? ` - ${chapter.title}` : ''} dos downloads?`,
			[
				{
					label: 'Cancelar',
					type: 'primary',
				},
				{
					label: 'Excluir',
					type: 'danger',
					callback: async () => {
						await this.downloadService.deleteChapter(chapter.id);
						this.chaptersDownloadStatus.update((map) => {
							const newMap = new Map(map);
							newMap.delete(chapter.id);
							return newMap;
						});
					},
				},
			],
			'warning',
		);
	}

	markChapterAsRead(chapter: Chapterlist) {
		this.chapterService.markAsRead(chapter.id).subscribe({
			next: () => {
				this.chapters.update((current) => {
					return current.map((c) =>
						c.id === chapter.id ? { ...c, read: true } : c,
					);
				});
			},
			error: (error) => {
				console.error('Error marking chapter as read:', error);
			},
		});
	}

	markChapterAsUnread(chapter: Chapterlist) {
		this.chapterService.markAsUnread(chapter.id).subscribe({
			next: () => {
				this.chapters.update((current) => {
					return current.map((c) =>
						c.id === chapter.id ? { ...c, read: false } : c,
					);
				});
			},
			error: (error) => {
				console.error('Error marking chapter as unread:', error);
			},
		});
	}

	loadCovers() {
		this.bookService.getCovers(this.id()).subscribe({
			next: (covers) => {
				this.covers.set(covers);
				this.originalCovers.set(JSON.parse(JSON.stringify(covers)));
				this.hasCoversChanged.set(false);
				this.scheduleHeightUpdate();
			},
			error: (error) => {
				console.error('Error loading covers:', error);
			},
		});
	}

	onCoverDrop(event: CdkDragDrop<Cover[]>) {
		if (!this.userTokenService.isAdminSignal()) return;

		this.covers.update((current) => {
			const newCovers = [...current];
			moveItemInArray(newCovers, event.previousIndex, event.currentIndex);
			return newCovers;
		});
		this.hasCoversChanged.set(true);
	}

	saveCoversOrder() {
		const bookId = this.id();
		if (!bookId) return;

		const coversOrder = this.covers().map((cover, index) => ({
			id: cover.id,
			index: index,
		}));

		this.bookService.orderCovers(bookId, coversOrder).subscribe({
			next: () => {
				this.originalCovers.set(
					JSON.parse(JSON.stringify(this.covers())),
				);
				this.hasCoversChanged.set(false);
				this.notificationService.success(
					'Ordem das capas salva com sucesso!',
				);
			},
			error: (error) => {
				console.error('Error saving covers order:', error);
				this.notificationService.error(
					'Erro ao salvar a ordem das capas.',
				);
			},
		});
	}

	cancelCoversReorder() {
		this.covers.set(JSON.parse(JSON.stringify(this.originalCovers())));
		this.hasCoversChanged.set(false);
	}

	loadExtraInfo() {
		this.bookService.getInfo(this.id()).subscribe({
			next: (info) => {
				this.extraInfo.set(info);
				this.scheduleHeightUpdate();
			},
			error: (error) => {
				console.error('Error loading extra info:', error);
			},
		});
	}

	loadSavedPages() {
		this.savedPagesService.getSavedPagesByBook(this.id()).subscribe({
			next: (pages) => {
				this.savedPages.set(pages);
				this.scheduleHeightUpdate();
			},
			error: (error) => {
				console.error('Error loading saved pages:', error);
			},
		});
	}

	urlTransform(url: string): string {
		try {
			return new URL(url).hostname;
		} catch (e) {
			return url;
		}
	}

	onCoverImageError(coverId: string) {
		this.coverImageErrors.update((set) => {
			const newSet = new Set(set);
			newSet.add(coverId);
			return newSet;
		});
	}

	onSavedPageClick(savedPage: SavedPage) {
		if (savedPage.page?.path) {
			this.openImageViewer(
				savedPage.page.path,
				`Capítulo ${savedPage.chapter.index} - Página ${savedPage.page.index}`,
				savedPage.comment,
			);
		}
	}

	onSavedPageContextMenu(event: MouseEvent, savedPage: SavedPage) {
		event.preventDefault();
		event.stopPropagation();

		const items: ContextMenuItem[] = [
			{
				label: 'Ver Imagem',
				icon: 'eye',
				action: () => this.onSavedPageClick(savedPage),
			},
			{
				label: 'Baixar Imagem',
				icon: 'download',
				action: () =>
					this.downloadImage(
						savedPage.page.path,
						`Page ${savedPage.page.index} - Chapter ${savedPage.chapter.index}`,
					),
			},
			{
				label: 'Editar Comentário',
				icon: 'edit',
				action: () => {
					this.notificationService.notify({
						message: '',
						level: 'custom',
						severity: NotificationSeverity.CRITICAL,
						component: PromptModalComponent,
						componentData: {
							title: 'Editar Comentário',
							message: 'Atualize o comentário desta página:',
							placeholder: 'Comentário...',
							value: savedPage.comment || '',
							close: (newComment: string | null) => {
								this.modalService.close();

								if (newComment !== null) {
									this.savedPagesService
										.updateComment(savedPage.id, newComment)
										.subscribe({
											next: (updatedPage) => {
												// Update local state
												this.savedPages.update(
													(current) => {
														return current.map(
															(p) =>
																p.id ===
																savedPage.id
																	? {
																			...p,
																			comment:
																				newComment,
																		}
																	: p,
														);
													},
												);
												this.notificationService.success(
													'Comentário atualizado!',
												);
											},
											error: (err) => {
												console.error(
													'Error updating comment',
													err,
												);
												this.notificationService.error(
													'Erro ao atualizar comentário.',
												);
											},
										});
								}
							},
						},
						useBackdrop: true,
						backdropOpacity: 0.5,
					});
				},
			},
			{ type: 'separator' },
			{
				label: 'Remover',
				icon: 'trash',
				danger: true,
				action: () => this.confirmDeleteSavedPage(savedPage),
			},
		];

		this.contextMenuService.open(event, items);
	}

	confirmDeleteSavedPage(savedPage: SavedPage) {
		this.modalService.show(
			'Remover Página Salva',
			'Tem certeza que deseja remover esta página dos seus salvos?',
			[
				{
					label: 'Cancelar',
					type: 'primary',
				},
				{
					label: 'Remover',
					type: 'danger',
					callback: () => {
						this.savedPagesService
							.unsavePage(savedPage.id)
							.subscribe({
								next: () => {
									this.savedPages.update((current) =>
										current.filter(
											(p) => p.id !== savedPage.id,
										),
									);
								},
								error: (err) =>
									console.error(
										'Error removing saved page:',
										err,
									),
							});
					},
				},
			],
		);
	}

	onChapterClick(event: MouseEvent, chapter: Chapterlist) {
		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();
			event.stopPropagation();
			this.toggleChapterSelection(chapter.id);
		}
	}

	toggleChapterSelection(chapterId: string) {
		this.selectedChapters.update((current) => {
			const next = new Set(current);
			if (next.has(chapterId)) {
				next.delete(chapterId);
			} else {
				next.add(chapterId);
			}
			return next;
		});
	}

	clearSelection() {
		this.selectedChapters.set(new Set());
	}

	selectAllChapters() {
		const allIds = new Set(this.chapters().map((c) => c.id));
		this.selectedChapters.set(allIds);
	}

	isChapterSelected(chapterId: string): boolean {
		return this.selectedChapters().has(chapterId);
	}

	hasDownloadedInSelection = computed(() => {
		const status = this.chaptersDownloadStatus();
		return Array.from(this.selectedChapters()).some(
			(id) => status.get(id) === 'downloaded',
		);
	});

	async downloadSelectedChapters() {
		const selectedIds = Array.from(this.selectedChapters());

		// Filtrar apenas capítulos que não estão baixados ou em download
		const chaptersToDownload = selectedIds.filter((id) => {
			const status = this.chaptersDownloadStatus().get(id);
			return !status || status === 'error';
		});

		if (chaptersToDownload.length === 0) {
			this.clearSelection();
			return;
		}

		// Marcar todos como "pending" antes de iniciar
		this.chaptersDownloadStatus.update((map) => {
			const newMap = new Map(map);
			for (const chapterId of chaptersToDownload) {
				newMap.set(chapterId, 'pending');
			}
			return newMap;
		});

		for (const chapterId of chaptersToDownload) {
			const chapter = this.chapters().find((c) => c.id === chapterId);
			if (chapter) {
				try {
					await this.downloadChapter(chapter);
				} catch (e) {
					console.error('Failed to download chapter:', chapterId, e);
				}
				// Delay maior para garantir que o download termine
				await new Promise((resolve) => setTimeout(resolve, 300));
			}
		}

		this.clearSelection();
	}

	deleteSelectedChaptersDownloads() {
		const selectedIds = Array.from(this.selectedChapters());

		// Filtrar apenas os que estão baixados
		const downloadedIds = selectedIds.filter(
			(id) => this.chaptersDownloadStatus().get(id) === 'downloaded',
		);

		if (downloadedIds.length === 0) {
			this.clearSelection();
			return;
		}

		this.modalService.show(
			'Excluir Downloads',
			`Deseja excluir ${downloadedIds.length} capítulo(s) dos downloads?`,
			[
				{
					label: 'Cancelar',
					type: 'primary',
				},
				{
					label: 'Excluir',
					type: 'danger',
					callback: async () => {
						for (const chapterId of downloadedIds) {
							await this.downloadService.deleteChapter(chapterId);
							this.chaptersDownloadStatus.update((map) => {
								const newMap = new Map(map);
								newMap.delete(chapterId);
								return newMap;
							});
						}
						this.clearSelection();
					},
				},
			],
			'warning',
		);
	}

	async toggleSelectedReadStatus() {
		const selectedIds = Array.from(this.selectedChapters());
		const selectedChapters = this.chapters().filter((c) =>
			selectedIds.includes(c.id),
		);

		// Se pelo menos um capítulo está lido, marcar todos como não lidos
		const hasReadChapter = selectedChapters.some((c) => c.read);

		try {
			if (hasReadChapter) {
				const results = await firstValueFrom(
					this.chapterService.markManyAsUnread(selectedIds),
				);
				// Atualizar estado local para os que foram marcados com sucesso
				this.chapters.update((current) => {
					const next = [...current];
					for (const result of results) {
						if (result.success) {
							const chapter = next.find(
								(c) => c.id === result.chapterId,
							);
							if (chapter) chapter.read = false;
						}
					}
					return next;
				});
			} else {
				const results = await firstValueFrom(
					this.chapterService.markManyAsRead(selectedIds),
				);
				// Atualizar estado local para os que foram marcados com sucesso
				this.chapters.update((current) => {
					const next = [...current];
					for (const result of results) {
						if (result.success) {
							const chapter = next.find(
								(c) => c.id === result.chapterId,
							);
							if (chapter) chapter.read = true;
						}
					}
					return next;
				});
			}
		} catch (error) {
			console.error('Error toggling chapters read status:', error);
		}

		this.clearSelection();
	}

	onChapterContextMenu(event: MouseEvent, chapter: Chapterlist) {
		event.preventDefault();
		event.stopPropagation();

		const items: ContextMenuItem[] = [];
		const selectedCount = this.selectedChapters().size;

		// Se houver múltiplos capítulos selecionados, mostrar opções em lote
		if (selectedCount > 1) {
			const status = this.chaptersDownloadStatus();
			const hasDownloaded = Array.from(this.selectedChapters()).some(
				(id) => status.get(id) === 'downloaded',
			);
			const hasNotDownloaded = Array.from(this.selectedChapters()).some(
				(id) => !status.get(id) || status.get(id) === 'error',
			);

			if (hasNotDownloaded) {
				items.push({
					label: `Baixar ${selectedCount} Capítulos`,
					icon: 'download',
					action: () => this.downloadSelectedChapters(),
				});
			}

			if (hasDownloaded) {
				items.push({
					label: `Excluir ${selectedCount} Downloads`,
					icon: 'trash',
					danger: true,
					action: () => this.deleteSelectedChaptersDownloads(),
				});
			}

			// Verificar se algum capítulo está lido
			const selectedChapters = this.chapters().filter((c) =>
				Array.from(this.selectedChapters()).includes(c.id),
			);
			const hasReadChapter = selectedChapters.some((c) => c.read);

			items.push(
				{ type: 'separator' },
				{
					label: hasReadChapter
						? `Marcar ${selectedCount} como Não Lidos`
						: `Marcar ${selectedCount} como Lidos`,
					icon: hasReadChapter ? 'eye-close' : 'eye',
					action: () => this.toggleSelectedReadStatus(),
				},
				{ type: 'separator' },
				{
					label: 'Limpar Seleção',
					icon: 'close',
					action: () => this.clearSelection(),
				},
			);

			this.contextMenuService.open(event, items);
			return;
		}

		// Menu para capítulo único
		const downloadStatus = this.chaptersDownloadStatus().get(chapter.id);

		if (downloadStatus === 'downloaded') {
			items.push({
				label: 'Excluir Download',
				icon: 'trash',
				danger: true,
				action: () => this.deleteChapterDownload(chapter),
			});
		} else if (!downloadStatus || downloadStatus === 'error') {
			items.push({
				label: 'Baixar Capítulo',
				icon: 'download',
				action: () => this.downloadChapter(chapter),
			});
		}

		if (chapter.read) {
			items.push({
				label: 'Marcar como Não Lido',
				icon: 'eye-close',
				action: () => this.markChapterAsUnread(chapter),
			});
		} else {
			items.push({
				label: 'Marcar como Lido',
				icon: 'eye',
				action: () => this.markChapterAsRead(chapter),
			});
		}

		this.contextMenuService.open(event, items);
	}

	onCoverContextMenu(event: MouseEvent, cover: Cover) {
		const items: ContextMenuItem[] = [];

		// Only show image-related options if cover has a URL and no error
		if (cover.url && !this.coverImageErrors().has(cover.id)) {
			items.push(
				{
					label: 'Copiar Imagem',
					icon: 'copy',
					action: () => this.copyImage(cover.url),
				},
				{
					label: 'Baixar Imagem',
					icon: 'download',
					action: () =>
						this.downloadImage(
							cover.url,
							cover.title || `cover-${cover.id}`,
						),
				},
			);
		}

		if (this.userTokenService.isAdminSignal()) {
			if (items.length > 0) {
				items.push({ type: 'separator' });
			}

			if (cover.url) {
				items.push({
					label: 'Selecionar Capa',
					icon: 'image',
					action: () => this.selectCover(cover),
				});
			}

			items.push(
				{
					label: 'Editar',
					icon: 'settings',
					action: () => this.openCoverEditModal(cover),
				},
				{ type: 'separator' },
				{
					label: 'Remover',
					icon: 'close',
					danger: true,
					action: () => this.confirmDeleteCover(cover),
				},
			);
		}

		this.contextMenuService.open(event, items);
	}

	onCoverClick(cover: Cover) {
		if (cover.url && !this.coverImageErrors().has(cover.id)) {
			this.openImageViewer(cover.url, cover.title);
		} else {
			// Open edit modal for covers without image or with loading error
			this.openCoverEditModal(cover);
		}
	}

	openImageViewer(url: string, title: string, description = '') {
		this.viewerImageUrl.set(url);
		this.viewerImageTitle.set(title);
		this.viewerImageDescription.set(description);
		this.showImageViewer.set(true);
		this.lockScroll();
	}

	closeImageViewer() {
		this.showImageViewer.set(false);
		this.viewerImageUrl.set('');
		this.viewerImageTitle.set('');
		this.viewerImageDescription.set('');
		this.unlockScroll();
	}

	private lockScroll(): void {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = 'hidden';
		}
	}

	private unlockScroll(): void {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	}

	openCoverEditModal(cover: Cover) {
		this.editingCover.set(cover);
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: CoverEditModalComponent,
			componentData: {
				cover: cover,
				close: (result: CoverEditSaveEvent | null) => {
					this.modalService.close();
					if (result) {
						this.onCoverEditSave(result);
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	closeCoverEditModal() {
		this.modalService.close();
		this.editingCover.set(null);
	}

	handleCoverEditClose = (result: CoverEditSaveEvent | null): void => {
		this.modalService.close();
		if (result) {
			this.onCoverEditSave(result);
		}
	};

	openSourceAddModal() {
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: SourceAddModalComponent,
			componentData: {
				existingUrls: this.extraInfo().originalUrl,
				close: (result: SourceAddSaveEvent | null) => {
					this.modalService.close();
					if (result) {
						this.onSourceAddSave(result);
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	closeSourceAddModal() {
		this.modalService.close();
	}

	handleSourceAddClose = (result: SourceAddSaveEvent | null): void => {
		this.modalService.close();
		if (result) {
			this.onSourceAddSave(result);
		}
	};

	onSourceAddSave(data: SourceAddSaveEvent) {
		// Adicionar nova URL ao array existente
		const updatedUrls = [...this.extraInfo().originalUrl, data.url];

		// Chamar API para atualizar o livro
		this.bookService
			.updateBook(this.id(), { originalUrl: updatedUrls })
			.subscribe({
				next: () => {
					// Atualizar estado local
					this.extraInfo.update((info) => ({
						...info,
						originalUrl: updatedUrls,
					}));
					this.closeSourceAddModal();
					this.notificationService.success(
						'Fonte adicionada com sucesso!',
					);
				},
				error: (error) => {
					console.error('Error adding source:', error);
					this.notificationService.error('Erro ao adicionar fonte.');
					this.closeSourceAddModal();
				},
			});
	}

	onSourceContextMenu(event: MouseEvent, source: string, index: number) {
		event.preventDefault();
		event.stopPropagation();

		if (!this.userTokenService.isAdminSignal()) return;

		const items: ContextMenuItem[] = [
			{
				label: 'Copiar URL',
				icon: 'copy',
				action: () => {
					navigator.clipboard.writeText(source);
					this.notificationService.success('URL copiada!');
				},
			},
			{ type: 'separator' },
			{
				label: 'Remover',
				icon: 'trash',
				danger: true,
				action: () => this.confirmRemoveSource(index),
			},
		];

		this.contextMenuService.open(event, items);
	}

	confirmRemoveSource(index: number) {
		const source = this.extraInfo().originalUrl[index];
		this.modalService.show(
			'Remover Fonte',
			`Tem certeza que deseja remover a fonte "${this.urlTransform(source)}"?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Remover',
					type: 'danger',
					callback: () => this.removeSource(index),
				},
			],
			'warning',
		);
	}

	removeSource(index: number) {
		const updatedUrls = this.extraInfo().originalUrl.filter(
			(_, i) => i !== index,
		);

		this.bookService
			.updateBook(this.id(), { originalUrl: updatedUrls })
			.subscribe({
				next: () => {
					this.extraInfo.update((info) => ({
						...info,
						originalUrl: updatedUrls,
					}));
					this.notificationService.success(
						'Fonte removida com sucesso!',
					);
				},
				error: (error) => {
					console.error('Error removing source:', error);
					this.notificationService.error('Erro ao remover fonte.');
				},
			});
	}

	onCoverEditSave(data: CoverEditSaveEvent) {
		if (data.file) {
			// Replace existing cover image
			this.bookService
				.replaceCoverImage(this.id(), data.id, data.file, data.title)
				.subscribe({
					next: (updatedCover) => {
						this.covers.update((current) => {
							const next = [...current];
							const coverIndex = next.findIndex(
								(c) => c.id === data.id,
							);
							if (coverIndex !== -1) {
								if (
									updatedCover.url &&
									!updatedCover.url.includes('?')
								) {
									updatedCover.url = `${updatedCover.url}?t=${Date.now()}`;
								}
								next[coverIndex] = updatedCover;
							}
							return next;
						});
						this.coverImageErrors.update((set) => {
							const next = new Set(set);
							next.delete(data.id);
							return next;
						});
						this.closeCoverEditModal();
					},
					error: (error: Error) => {
						console.error('Error replacing cover image:', error);
					},
				});
		} else {
			// Just update the title
			this.bookService
				.updateCover(this.id(), data.id, { title: data.title })
				.subscribe({
					next: () => {
						this.covers.update((current) => {
							const next = [...current];
							const coverIndex = next.findIndex(
								(c) => c.id === data.id,
							);
							if (coverIndex !== -1) {
								next[coverIndex] = {
									...next[coverIndex],
									title: data.title,
								};
							}
							return next;
						});
						this.closeCoverEditModal();
					},
					error: (error: Error) => {
						console.error('Error updating cover:', error);
					},
				});
		}
	}

	confirmDeleteCover(cover: Cover) {
		this.modalService.show(
			'Remover Capa',
			`Tem certeza que deseja remover esta capa${cover.title ? ` "${cover.title}"` : ''}?`,
			[
				{
					label: 'Cancelar',
					type: 'primary',
				},
				{
					label: 'Remover',
					type: 'danger',
					callback: () => this.deleteCover(cover),
				},
			],
		);
	}

	deleteCover(cover: Cover) {
		this.bookService.deleteCover(this.id(), cover.id).subscribe({
			next: () => {
				this.covers.update((current) =>
					current.filter((c) => c.id !== cover.id),
				);
			},
			error: (error: Error) => {
				console.error('Error deleting cover:', error);
			},
		});
	}

	copyImage(url: string) {
		navigator.clipboard
			.writeText(url)
			.then(() => {
				// console.log('Image URL copied');
			})
			.catch((err) => {
				console.error('Failed to copy: ', err);
			});
	}

	async downloadImage(url: string, filename: string) {
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const extension = blob.type.split('/')[1] || 'jpg';
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `${filename}.${extension}`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(link.href);
		} catch (err) {
			console.error('Failed to download image: ', err);
		}
	}

	selectCover(cover: Cover) {
		this.modalService.show(
			'Confirmar troca de capa',
			'Tem certeza que deseja trocar a capa do livro?',
			[
				{
					label: 'Cancelar',
					type: 'primary',
				},
				{
					label: 'Sim',
					type: 'danger',
					callback: () => {
						this.bookService
							.selectCover(this.id(), cover.id)
							.subscribe({
								next: (book) => {
									window.location.reload();
								},
							});
					},
				},
			],
		);
	}
}
