import {
	CdkDragDrop,
	DragDropModule,
	moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
	DecimalPipe,
	isPlatformBrowser,
	Location,
	NgTemplateOutlet,
} from '@angular/common';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	input,
	NgZone,
	OnDestroy,
	output,
	PLATFORM_ID,
	QueryList,
	signal,
	ViewChild,
	ViewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { BookRelationshipService } from '@core/services/book-relationship.service';
import { ChapterService } from '@core/services/chapter.service';
import { ContextMenuService } from '@core/services/context-menu.service';
import { DownloadService } from '@core/services/download.service';
import { ModalNotificationService } from '@core/services/modal-notification.service';
import { NotificationSeverity } from '@core/services/notification';
import { NotificationService } from '@core/services/notification.service';
import { SavedPagesService } from '@core/services/saved-pages.service';
import { UserService } from '@core/services/user.service';
import { UserTokenService } from '@core/services/user-token.service';
import {
	Book,
	BookBasic,
	BookDetail,
	Chapterlist,
	ContentTypes,
	Cover,
	ImageMetadata,
	ScrapingStatus,
} from '@models/book.models';
import { RelatedBookItem } from '@models/book-relationship.models';
import { ContextMenuItem } from '@models/context-menu.models';
import { DownloadStatus } from '@models/offline.models';
import { SavedPage } from '@models/saved-page.models';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { ChapterIndexPipe } from '@shared/utils/pipes/chapter-index.pipe';
import { FlagPipe } from '@shared/utils/pipes/flag.pipe';
import { ScrapingStatusPipe } from '@shared/utils/pipes/scraping-status.pipe';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { SelectComponent } from '@ui/atoms/inputs/select/select.component';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';
import {
	AddRelatedBookModalComponent,
	BookAltTitlesModalComponent,
	BookAltTitlesSaveEvent,
	BookEditModalComponent,
	BookEditSaveEvent,
} from '@ui/molecules/notification/custom-components';
import {
	CoverEditModalComponent,
	CoverEditSaveEvent,
} from '@ui/molecules/notification/custom-components/cover-edit-modal/cover-edit-modal.component';
import { PromptModalComponent } from '@ui/molecules/notification/custom-components/prompt-modal/prompt-modal.component';
import {
	SourceAddModalComponent,
	SourceAddSaveEvent,
} from '@ui/molecules/notification/custom-components/source-add-modal/source-add-modal.component';
import { ImageViewerComponent } from '@ui/organisms/image-viewer/image-viewer.component';
import { firstValueFrom, fromEvent, Subscription, throttleTime } from 'rxjs';
import { BookReviewFormComponent } from '../book-review-form/book-review-form.component';
import { BookReviewsListComponent } from '../book-reviews-list/book-reviews-list.component';
import { ChapterGroupComponent } from '../chapter-group/chapter-group.component';
import { ItemBookComponent } from '../item-book/item-book.component';

enum tab {
	chapters = 0,
	covers = 1,
	extraInfo = 2,
	savedPages = 3,
	relatedBooks = 4,
	reviews = 5,
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
		NgTemplateOutlet,
		ChapterIndexPipe,
		FlagPipe,
		ScrapingStatusPipe,
		IconsComponent,
		ButtonComponent,
		SelectComponent,
		ChapterGroupComponent,
		ImageViewerComponent,
		BlurhashComponent,
		ItemBookComponent,
		DragDropModule,
		BookReviewFormComponent,
		BookReviewsListComponent,
		RouterLink,
		HasPermissionDirective,
		FormsModule,
	],
	templateUrl: './info-book.component.html',
	styleUrl: './info-book.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(window:resize)': 'updateContainerHeight()',
	},
})
export class InfoBookComponent implements AfterViewInit, OnDestroy {
	public userService = inject(UserService);
	private bookService = inject(BookService);
	private relationshipService = inject(BookRelationshipService);
	private modalService = inject(ModalNotificationService);
	private downloadService = inject(DownloadService);
	private chapterService = inject(ChapterService);
	private contextMenuService = inject(ContextMenuService);
	private savedPagesService = inject(SavedPagesService);
	public userTokenService = inject(UserTokenService);
	private notificationService = inject(NotificationService);
	private platformId = inject(PLATFORM_ID);
	private ngZone = inject(NgZone);
	private router = inject(Router);
	private location = inject(Location);
	private resizeObserver?: ResizeObserver;
	private mutationObserver?: MutationObserver;

	tab = tab;
	ScrapingStatus = ScrapingStatus;

	id = input.required<string>();
	bookBasic = input<BookBasic | undefined>();
	hasReadPartially = input<boolean>(false);
	updated = output<void>();

	selectedTab = signal<tab>(tab.chapters);
	sortAscending = signal(true);

	tabsList = [
		{ id: tab.chapters, label: 'Capítulos' },
		{ id: tab.covers, label: 'Artes' },
		{ id: tab.extraInfo, label: 'Informações extras' },
		{ id: tab.savedPages, label: 'Páginas Salvas' },
		{ id: tab.relatedBooks, label: 'Relacionados' },
		{ id: tab.reviews, label: 'Avaliações' },
	];

	private websocketSubscription?: Subscription;
	private downloadSubscription?: Subscription;
	private intersectionObserver?: IntersectionObserver;

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
		{
			load: signal(false),
			function: async () => this.loadRelatedBooks(),
		},
		{
			load: signal(false),
			function: async () => {
				/* Reviews load handled by component */
			},
		},
	];
	chapters = signal<Chapterlist[]>([]);
	nextChaptersCursor = signal<string | null>(null);
	hasMoreChapters = signal(false);
	isLoadingMoreChapters = signal(false);
	readonly chaptersPageLimit = 200;
	availableLanguages = signal<string[]>([]);
	selectedLanguage = signal<string | undefined>(undefined);

	languageOptions = computed(() => {
		const flagPipe = new FlagPipe();
		const options: import('@ui/atoms/inputs/select/select.component').SelectOption[] =
			[
				{
					value: 'all',
					label: 'Todos os Idiomas',
					imageUrl: flagPipe.transform('un'),
				},
			];
		for (const lang of this.availableLanguages()) {
			options.push({
				value: lang,
				label: lang.toUpperCase(),
				imageUrl: flagPipe.transform(lang),
			});
		}
		return options;
	});

	groupedChapters = computed(() => {
		const map = new Map<
			number,
			import('../chapter-group/chapter-group.component').ChapterGroupData
		>();
		const chapters = this.chapters();

		for (const chapter of chapters) {
			if (!map.has(chapter.index)) {
				map.set(chapter.index, {
					index: chapter.index,
					title: chapter.title,
					chapters: [],
				});
			}
			map.get(chapter.index)!.chapters.push(chapter);
		}

		return Array.from(map.values());
	});

	useChapterGroup = computed(() => {
		return this.availableLanguages().length > 1 && !this.selectedLanguage();
	});

	covers = signal<Cover[]>([]);
	originalCovers = signal<Cover[]>([]);
	isReorderingCovers = signal(false);
	hasCoversChanged = signal(false);

	savedPages = signal<SavedPage[]>([]);
	relatedBooks = signal<RelatedBookItem[]>([]);
	groupedRelatedBooks = computed(() => {
		const groups = new Map<string, RelatedBookItem[]>();
		for (const rel of this.relatedBooks()) {
			const arr = groups.get(rel.relationType) || [];
			arr.push(rel);
			groups.set(rel.relationType, arr);
		}
		return Array.from(groups.entries())
			.map(([type, items]) => ({
				type,
				label: this.getRelationTypeLabel(type),
				items,
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	});
	relatedBooksTotal = signal(0);
	isEditingRelatedBooks = signal(false);
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
	isChaptersSelectionMode = signal(false);
	isCoversSelectionMode = signal(false);
	selectedChapters = signal<Set<string>>(new Set());
	selectedCovers = signal<Set<string>>(new Set());

	// Image viewer state
	showImageViewer = signal(false);
	viewerImageUrl = signal('');
	viewerImageTitle = signal('');
	viewerImageDescription = signal('');
	viewerImageMetadata = signal<ImageMetadata | undefined>(undefined);

	// Cover edit modal state
	editingCover = signal<Cover | null>(null);

	// Track cover image loading errors
	coverImageErrors = signal<Set<string>>(new Set());

	@ViewChild('selector') selector!: ElementRef<HTMLDivElement>;
	@ViewChildren('tabEl') tabEls!: QueryList<ElementRef<HTMLSpanElement>>;
	@ViewChild('container') containerElement!: ElementRef<HTMLDivElement>;
	@ViewChild('scrollSentinel') scrollSentinel?: ElementRef<HTMLDivElement>;

	containerHeight = signal('auto');

	ngAfterViewInit() {
		// Clique inicial na primeira aba disponível
		setTimeout(() => {
			const first = this.tabEls.first;
			if (first) {
				first.nativeElement.click();
			}
		});

		if (isPlatformBrowser(this.platformId)) {
			this.setupResizeObserver();
			this.setupIntersectionObserver();
			window.addEventListener('resize', this.onWindowResize.bind(this));
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
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
		}
		if (isPlatformBrowser(this.platformId)) {
			window.removeEventListener(
				'resize',
				this.onWindowResize.bind(this),
			);
		}
	}

	private subscribeToWebSocketEvents() {
		const bookId = this.id();
		if (!bookId) return;

		this.websocketSubscription = this.bookService
			.watchBook(bookId)
			.subscribe({
				next: (event: unknown) => {
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
				error: (error: unknown) => {
					console.error('❌ Erro no WebSocket:', error);
				},
			});
	}

	private onWindowResize = () => {
		this.updateSelectorPosition();
	};

	selectTab(tabName: tab, event?: Event) {
		this.selectedTab.set(tabName);
		this.loadResults(tabName);

		let clickedElement: HTMLSpanElement | undefined;

		if (event) {
			clickedElement = event.target as HTMLSpanElement;
		} else {
			// Find element by tab name if no event
			const index = this.tabsList.findIndex((t) => t.id === tabName);
			if (index >= 0) {
				clickedElement = this.tabEls.toArray()[index].nativeElement;
			}
		}

		if (clickedElement) {
			clickedElement.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'center',
			});
			this.updateSelectorPosition(clickedElement);
		}

		// Atualizar altura imediatamente e após animação
		this.observeActiveTab();
	}

	private updateSelectorPosition(element?: HTMLSpanElement) {
		if (!this.selector?.nativeElement) return;

		let targetElement = element;
		if (!targetElement) {
			const index = this.tabsList.findIndex(
				(t) => t.id === this.selectedTab(),
			);
			if (index >= 0 && this.tabEls?.length) {
				targetElement = this.tabEls.toArray()[index].nativeElement;
			}
		}

		if (targetElement) {
			const left = targetElement.offsetLeft;
			const width = targetElement.offsetWidth;

			const selectorEl = this.selector.nativeElement;
			selectorEl.style.left = `${left}px`;
			selectorEl.style.width = `${width}px`;
		}
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

	private setupIntersectionObserver() {
		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry.isIntersecting) {
					this.ngZone.run(() => {
						if (
							this.selectedTab() === tab.chapters &&
							this.hasMoreChapters() &&
							!this.isLoadingMoreChapters()
						) {
							this.loadMoreChapters();
						}
					});
				}
			},
			{
				rootMargin: '1000px',
				threshold: 0,
			}
		);
	}

	private observeScrollSentinel() {
		if (this.intersectionObserver && this.scrollSentinel?.nativeElement) {
			this.intersectionObserver.disconnect();
			this.intersectionObserver.observe(this.scrollSentinel.nativeElement);
		}
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
			this.observeScrollSentinel();
			setTimeout(() => {
				this.updateContainerHeight();
				this.observeScrollSentinel();
			}, 50);
			setTimeout(() => this.updateContainerHeight(), 150);
			setTimeout(() => this.updateContainerHeight(), 500);
		});
	}

	private scheduleLoadMoreCheck() {
		requestAnimationFrame(() => {
			// No-op for compatibility, IntersectionObserver handles it
		});
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
			return [...currentChapters].sort((a, b) => {
				const indexDiff = asc ? a.index - b.index : b.index - a.index;
				if (indexDiff !== 0) {
					return indexDiff;
				}
				
				const langA = a.languageCode || '';
				const langB = b.languageCode || '';
				return langA.localeCompare(langB);
			});
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
		// Legacy method kept for compatibility with tests, use IntersectionObserver instead
		if (
			this.selectedTab() !== tab.chapters ||
			!this.hasMoreChapters() ||
			this.isLoadingMoreChapters()
		) {
			return;
		}
		this.loadMoreChapters();
	}

	onLanguageChange(langValue: string) {
		if (typeof langValue !== 'string') return;
		const newLang = langValue === 'all' ? undefined : langValue;
		if (this.selectedLanguage() !== newLang) {
			this.selectedLanguage.set(newLang);
			this.chapters.set([]);
			this.loadChapters();
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
				languageCode: this.selectedLanguage(),
			})
			.subscribe({
				next: (chapters) => {
					const updatedChapters = append
						? [...this.chapters(), ...chapters.data]
						: chapters.data;

					this.chapters.set(updatedChapters);
					if (!this.selectedLanguage()) {
						this.availableLanguages.set(
							chapters.availableLanguages || [],
						);
					}
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

	confirmResetChapter(chapter: Chapterlist) {
		this.modalService.show(
			'Redefinir Capítulo',
			`Tem certeza que deseja redefinir o capítulo ${chapter.index}${chapter.title ? ` - ${chapter.title}` : ''}?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Redefinir',
					type: 'danger',
					callback: () => {
						this.chapterService
							.resetChapter(chapter.id)
							.subscribe(() => {
								this.notificationService.success(
									`Capítulo ${chapter.index} redefinido com sucesso!`,
								);
								// Se estiver na aba de capítulos, recarregar a lista
								if (this.selectedTab() === tab.chapters) {
									this.loadChapters();
								}
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

	openAltTitlesModal() {
		const book = this.bookBasic();
		if (!book) return;

		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: BookAltTitlesModalComponent,
			componentData: {
				book: book,
				close: (result: BookAltTitlesSaveEvent | null) => {
					this.modalService.close();
					if (result) {
						this.bookService
							.updateBook(result.id, result.data)
							.subscribe({
								next: () => {
									this.notificationService.success(
										'Títulos alternativos atualizados com sucesso!',
									);
									this.updated.emit();
								},
								error: (err) => {
									this.notificationService.error(
										'Erro ao atualizar títulos alternativos',
									);
									console.error(err);
								},
							});
					}
				},
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

	loadRelatedBooks() {
		this.relationshipService.getBookRelationships(this.id()).subscribe({
			next: (page) => {
				this.relatedBooks.set(page.items);
				this.scheduleHeightUpdate();
			},
			error: (error) => {
				console.error('Error loading related books:', error);
			},
		});
	}

	toggleEditRelatedBooks() {
		this.isEditingRelatedBooks.update((val) => !val);
	}

	openAddRelatedBookModal() {
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: AddRelatedBookModalComponent,
			componentData: {
				sourceBookId: this.id(),
				close: (success: boolean) => {
					this.modalService.close();
					if (success) {
						this.loadRelatedBooks();
						this.updated.emit();
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	confirmDeleteRelationship(rel: RelatedBookItem) {
		this.modalService.show(
			'Remover Relacionamento',
			`Tem certeza que deseja remover o vínculo com "${rel.relatedBook.title}"?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Remover',
					type: 'danger',
					callback: () => {
						this.relationshipService
							.deleteRelationship(this.id(), rel.relationId)
							.subscribe(() => {
								this.notificationService.success(
									'Relacionamento removido com sucesso!',
								);
								this.loadRelatedBooks();
								this.updated.emit();
							});
					},
				},
			],
			'warning',
		);
	}

	getRelationTypeLabel(type: string): string {
		return this.relationshipService.getRelationTypeLabel(type);
	}

	urlTransform(url: string): string {
		try {
			return new URL(url).hostname;
		} catch (_e) {
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
				savedPage.page.metadata,
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
				label: 'Abrir imagem em nova aba',
				icon: 'link',
				action: () => {
					if (savedPage.page.path) {
						window.open(savedPage.page.path, '_blank');
					}
				},
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
											next: (_updatedPage) => {
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
		if (this.isChaptersSelectionMode() || event.ctrlKey || event.metaKey) {
			event.preventDefault();
			event.stopPropagation();
			this.toggleChapterSelection(chapter.id);
		}
	}

	toggleChaptersSelectionMode() {
		this.isChaptersSelectionMode.update((v) => !v);
		if (!this.isChaptersSelectionMode()) {
			this.clearSelection();
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
		this.isChaptersSelectionMode.set(false);
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
		const isSelected = this.selectedChapters().has(chapter.id);

		// Se houver múltiplos capítulos selecionados e o clicado fizer parte da seleção, mostrar opções em lote
		if (selectedCount > 1 && isSelected) {
			const status = this.chaptersDownloadStatus();
			const hasDownloaded = Array.from(this.selectedChapters()).some(
				(id) => status.get(id) === 'downloaded',
			);
			const hasNotDownloaded = Array.from(this.selectedChapters()).some(
				(id) => !status.get(id) || status.get(id) === 'error',
			);

			if (
				hasNotDownloaded &&
				this.userService.hasPermission('books:download')
			) {
				items.push({
					label: `Baixar ${selectedCount} Capítulos`,
					icon: 'download',
					action: () => this.downloadSelectedChapters(),
				});
			}

			if (
				hasDownloaded &&
				this.userService.hasPermission('books:download')
			) {
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

			if (this.userService.hasPermission('reading-progress:manage')) {
				items.push(
					{ type: 'separator' },
					{
						label: hasReadChapter
							? `Marcar ${selectedCount} como Não Lidos`
							: `Marcar ${selectedCount} como Lidos`,
						icon: hasReadChapter ? 'eye-close' : 'eye',
						action: () => this.toggleSelectedReadStatus(),
					},
				);
			}

			if (this.userTokenService.isAdminSignal()) {
				items.push(
					{ type: 'separator' },
					{
						label: `Resetar ${selectedCount} Capítulos`,
						icon: 'refresh-ccw',
						action: () => this.confirmBulkResetChapters(),
					},
					{
						label: `Corrigir ${selectedCount} Capítulos`,
						icon: 'settings',
						action: () => this.confirmBulkFixChapters(),
					},
					{
						label: `Apagar ${selectedCount} Capítulos`,
						icon: 'trash',
						danger: true,
						action: () => this.confirmBulkDeleteChapters(),
					}
				);
			}

			items.push(
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
		items.push({
			label: 'Abrir em nova aba',
			icon: 'link',
			action: () => {
				const urlTree = this.router.createUrlTree([
					'/books',
					this.id(),
					chapter.id,
				]);
				const url = this.location.prepareExternalUrl(
					this.router.serializeUrl(urlTree),
				);
				window.open(window.location.origin + url, '_blank');
			},
		});

		const downloadStatus = this.chaptersDownloadStatus().get(chapter.id);

		if (
			downloadStatus === 'downloaded' &&
			this.userService.hasPermission('books:download')
		) {
			items.push({
				label: 'Excluir Download',
				icon: 'trash',
				danger: true,
				action: () => this.deleteChapterDownload(chapter),
			});
		} else if (
			(!downloadStatus || downloadStatus === 'error') &&
			this.userService.hasPermission('books:download')
		) {
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

		if (this.userTokenService.isAdminSignal()) {
			items.push({ type: 'separator' });
			items.push(
				{
					label: 'Resetar Capítulo',
					icon: 'refresh-ccw',
					action: () => this.confirmResetChapter(chapter),
				},
				{
					label: 'Corrigir Capítulo',
					icon: 'settings',
					action: () => this.confirmFixChapter(chapter),
				}
			);
			if (chapter.originalUrl) {
				items.push({
					label: 'Link Original',
					icon: 'globe',
					action: () => window.open(chapter.originalUrl, '_blank'),
				});
			}
			items.push(
				{ type: 'separator' },
				{
					label: 'Apagar Capítulo',
					icon: 'trash',
					danger: true,
					action: () => this.confirmDeleteChapter(chapter),
				}
			);
		}

		this.contextMenuService.open(event, items);
	}

	confirmFixChapter(chapter: Chapterlist) {
		this.modalService.show(
			'Corrigir Capítulo',
			`Tem certeza que deseja corrigir o capítulo ${chapter.index}${chapter.title ? ` - ${chapter.title}` : ''}?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Corrigir',
					type: 'danger',
					callback: () => {
						this.chapterService
							.fixChapter(chapter.id)
							.subscribe(() => {
								this.notificationService.success(
									`Capítulo ${chapter.index} corrigido com sucesso!`,
								);
								if (this.selectedTab() === tab.chapters) {
									this.loadChapters();
								}
							});
					},
				},
			],
			'info',
		);
	}

	confirmDeleteChapter(chapter: Chapterlist) {
		this.modalService.show(
			'Apagar Capítulo',
			`Tem certeza que deseja apagar o capítulo ${chapter.index}${chapter.title ? ` - ${chapter.title}` : ''}? Esta ação é irreversível.`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Apagar',
					type: 'danger',
					callback: () => {
						this.chapterService
							.deleteChapter(chapter.id)
							.subscribe(() => {
								this.notificationService.success(
									`Capítulo ${chapter.index} apagado com sucesso!`,
								);
								if (this.selectedTab() === tab.chapters) {
									this.loadChapters();
								}
							});
					},
				},
			],
			'warning',
		);
	}

	confirmBulkResetChapters() {
		const selectedIds = Array.from(this.selectedChapters());
		this.modalService.show(
			'Resetar Capítulos',
			`Tem certeza que deseja resetar ${selectedIds.length} capítulos?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Resetar',
					type: 'danger',
					callback: async () => {
						this.notificationService.info('Resetando capítulos...', 'Aguarde');
						for (const id of selectedIds) {
							try {
								await firstValueFrom(this.chapterService.resetChapter(id));
							} catch (e) {
								console.error('Error resetting chapter', id, e);
							}
						}
						this.notificationService.success('Capítulos resetados!');
						this.clearSelection();
					},
				},
			],
			'warning',
		);
	}

	confirmBulkFixChapters() {
		const selectedIds = Array.from(this.selectedChapters());
		this.modalService.show(
			'Corrigir Capítulos',
			`Tem certeza que deseja corrigir ${selectedIds.length} capítulos?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Corrigir',
					type: 'danger',
					callback: async () => {
						this.notificationService.info('Corrigindo capítulos...', 'Aguarde');
						for (const id of selectedIds) {
							try {
								await firstValueFrom(this.chapterService.fixChapter(id));
							} catch (e) {
								console.error('Error fixing chapter', id, e);
							}
						}
						this.notificationService.success('Capítulos corrigidos!');
						this.clearSelection();
						if (this.selectedTab() === tab.chapters) {
							this.loadChapters();
						}
					},
				},
			],
			'warning',
		);
	}

	confirmBulkDeleteChapters() {
		const selectedIds = Array.from(this.selectedChapters());
		this.modalService.show(
			'Apagar Capítulos',
			`Tem certeza que deseja apagar ${selectedIds.length} capítulos? Esta ação é irreversível.`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Apagar',
					type: 'danger',
					callback: async () => {
						this.notificationService.info('Apagando capítulos...', 'Aguarde');
						for (const id of selectedIds) {
							try {
								await firstValueFrom(this.chapterService.deleteChapter(id));
							} catch (e) {
								console.error('Error deleting chapter', id, e);
							}
						}
						this.notificationService.success('Capítulos apagados!');
						this.clearSelection();
						if (this.selectedTab() === tab.chapters) {
							this.loadChapters();
						}
					},
				},
			],
			'warning',
		);
	}

	confirmBulkResetCovers() {
		const selectedIds = Array.from(this.selectedCovers());
		this.modalService.show(
			'Resetar Capas',
			`Tem certeza que deseja resetar ${selectedIds.length} capas?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Resetar',
					type: 'danger',
					callback: async () => {
						this.notificationService.info('Resetando capas...', 'Aguarde');
						for (const id of selectedIds) {
							try {
								await firstValueFrom(this.bookService.resetCover(this.id(), id));
							} catch (e) {
								console.error('Error resetting cover', id, e);
							}
						}
						this.notificationService.success('Capas resetadas com sucesso!');
						this.clearCoverSelection();
					},
				},
			],
			'warning',
		);
	}

	confirmBulkFixCovers() {
		const selectedIds = Array.from(this.selectedCovers());
		this.modalService.show(
			'Corrigir Capas',
			`Tem certeza que deseja corrigir ${selectedIds.length} capas?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Corrigir',
					type: 'danger',
					callback: async () => {
						this.notificationService.info('Corrigindo capas...', 'Aguarde');
						for (const id of selectedIds) {
							try {
								await firstValueFrom(this.bookService.fixCover(this.id(), id));
							} catch (e) {
								console.error('Error fixing cover', id, e);
							}
						}
						this.notificationService.success('Capas corrigidas com sucesso!');
						this.clearCoverSelection();
					},
				},
			],
			'warning',
		);
	}

	confirmBulkDeleteCovers() {
		const selectedIds = Array.from(this.selectedCovers());
		this.modalService.show(
			'Apagar Capas',
			`Tem certeza que deseja apagar ${selectedIds.length} capas? Esta ação é irreversível.`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Apagar',
					type: 'danger',
					callback: async () => {
						this.notificationService.info('Apagando capas...', 'Aguarde');
						for (const id of selectedIds) {
							try {
								await firstValueFrom(this.bookService.deleteCover(this.id(), id));
							} catch (e) {
								console.error('Error deleting cover', id, e);
							}
						}
						this.notificationService.success('Capas apagadas com sucesso!');
						this.clearCoverSelection();
					},
				},
			],
			'warning',
		);
	}

	toggleCoversSelectionMode() {
		this.isCoversSelectionMode.update((v) => !v);
		if (!this.isCoversSelectionMode()) {
			this.clearCoverSelection();
		}
	}

	toggleCoverSelection(coverId: string) {
		this.selectedCovers.update((current) => {
			const next = new Set(current);
			if (next.has(coverId)) {
				next.delete(coverId);
			} else {
				next.add(coverId);
			}
			return next;
		});
	}

	clearCoverSelection() {
		this.selectedCovers.set(new Set());
		this.isCoversSelectionMode.set(false);
	}

	selectAllCovers() {
		const allIds = new Set(this.covers().map((c) => c.id));
		this.selectedCovers.set(allIds);
	}

	isCoverSelected(coverId: string): boolean {
		return this.selectedCovers().has(coverId);
	}

	onCoversContainerContextMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		
		if (!this.userService.hasPermission('internal:books:edit')) return;

		const items: ContextMenuItem[] = [
			{
				label: 'Fazer Upload de Capa',
				icon: 'upload',
				action: () => this.redefineCover(),
			},
			{
				label: 'Adicionar Capa via URL',
				icon: 'globe',
				action: () => this.correctCover(),
			},
			{ type: 'separator' },
			{
				label: 'Corrigir Todas as Capas',
				icon: 'refresh-ccw',
				action: () => this.fixCovers(),
			}
		];
		
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

			const selectedCount = this.selectedCovers().size;

			if (selectedCount > 1 && this.selectedCovers().has(cover.id)) {
				// Bulk options for covers
				items.push(
					{
						label: `Resetar ${selectedCount} Capas`,
						icon: 'refresh-ccw',
						action: () => this.confirmBulkResetCovers(),
					},
					{
						label: `Corrigir ${selectedCount} Capas`,
						icon: 'settings',
						action: () => this.confirmBulkFixCovers(),
					},
					{ type: 'separator' },
					{
						label: `Apagar ${selectedCount} Capas`,
						icon: 'trash',
						danger: true,
						action: () => this.confirmBulkDeleteCovers(),
					},
					{ type: 'separator' },
					{
						label: 'Limpar Seleção',
						icon: 'close',
						action: () => this.clearCoverSelection(),
					}
				);
			} else {
				if (cover.url) {
					items.push({
						label: 'Selecionar como Capa Principal',
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
						label: 'Resetar Capa',
						icon: 'refresh-ccw',
						action: () => this.confirmResetCover(cover),
					},
					{
						label: 'Corrigir Capa',
						icon: 'settings',
						action: () => this.fixSpecificCover(cover),
					},
					{ type: 'separator' },
					{
						label: 'Apagar',
						icon: 'trash',
						danger: true,
						action: () => this.confirmDeleteCover(cover),
					},
				);
			}
		}

		this.contextMenuService.open(event, items);
	}

	confirmResetCover(cover: Cover) {
		this.modalService.show(
			'Resetar Capa',
			`Tem certeza que deseja resetar a capa "${cover.title || cover.id}"?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Resetar',
					type: 'danger',
					callback: () => {
						this.bookService
							.resetCover(this.id(), cover.id)
							.subscribe({
								next: () => {
									this.notificationService.success(
										'Tarefa de reset da capa agendada.',
										'Processando',
									);
									this.modalService.close();
								},
								error: (err) => {
									console.error('Error resetting cover:', err);
									this.notificationService.error(
										'Erro ao agendar reset da capa.',
									);
									this.modalService.close();
								},
							});
					},
				},
			],
			'info',
		);
	}

	onCoverClick(event: MouseEvent, cover: Cover) {
		if (
			this.userService.hasPermission('internal:books:edit') &&
			(this.isCoversSelectionMode() || event.ctrlKey || event.metaKey)
		) {
			event.preventDefault();
			event.stopPropagation();
			this.toggleCoverSelection(cover.id);
			return;
		}

		if (cover.url && !this.coverImageErrors().has(cover.id)) {
			this.openImageViewer(cover.url, cover.title, '', cover.metadata);
		} else {
			// Open edit modal for covers without image or with loading error
			this.openCoverEditModal(cover);
		}
	}

	openImageViewer(
		url: string,
		title: string,
		description = '',
		metadata?: ImageMetadata,
	) {
		this.viewerImageUrl.set(url);
		this.viewerImageTitle.set(title);
		this.viewerImageDescription.set(description);
		this.viewerImageMetadata.set(metadata);
		this.showImageViewer.set(true);
		this.lockScroll();
	}

	closeImageViewer() {
		this.showImageViewer.set(false);
		this.viewerImageUrl.set('');
		this.viewerImageTitle.set('');
		this.viewerImageDescription.set('');
		this.viewerImageMetadata.set(undefined);
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

	openBookEditModal() {
		const book = this.bookBasic();
		if (!book) return;

		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: BookEditModalComponent,
			componentData: {
				book: book,
				close: (result: BookEditSaveEvent | null) => {
					this.modalService.close();
					if (result) {
						this.onBookEditSave(result);
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	onBookEditSave(event: BookEditSaveEvent) {
		this.bookService.updateBook(event.id, event.data).subscribe({
			next: () => {
				this.notificationService.success(
					'Livro atualizado com sucesso!',
				);
				this.updated.emit();

				// Recarrega dados das abas locais se já foram carregados
				if (this.modulesLoad[this.tab.extraInfo].load()) {
					this.loadExtraInfo();
				}
				if (this.modulesLoad[this.tab.covers].load()) {
					this.loadCovers();
				}
				if (this.modulesLoad[this.tab.chapters].load()) {
					this.loadChapters();
				}
			},
			error: (err) => {
				console.error('Error updating book:', err);
				this.notificationService.error('Erro ao atualizar livro.');
			},
		});
	}

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
		// Chamar API para atualizar o livro com a nova lista (incluindo ordem)
		this.bookService
			.updateBook(this.id(), { originalUrl: data.urls })
			.subscribe({
				next: () => {
					// Atualizar estado local
					this.extraInfo.update((info) => ({
						...info,
						originalUrl: data.urls,
					}));
					this.closeSourceAddModal();
					this.notificationService.success(
						'Fontes atualizadas com sucesso!',
					);
				},
				error: (error) => {
					console.error('Error updating sources:', error);
					this.notificationService.error('Erro ao atualizar fontes.');
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
				label: 'Abrir em nova aba',
				icon: 'link',
				action: () => window.open(source, '_blank'),
			},
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
								next: () => {
									this.notificationService.success(
										'Capa alterada com sucesso!',
									);
									this.updated.emit();
									this.loadCovers();
								},
							});
					},
				},
			],
		);
	}

	redefineCover() {
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: PromptModalComponent,
			componentData: {
				title: 'Adicionar Nova Capa',
				message: 'Informe um nome para a nova capa:',
				placeholder: 'Ex: Capa Volume 1...',
				value: '',
				close: (title: string | null) => {
					this.modalService.close();
					if (title !== null) {
						this.openFileSelectorForUpload(title.trim());
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	private openFileSelectorForUpload(title: string) {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = 'image/*';
		fileInput.onchange = (event: Event) => {
			const target = event.target as HTMLInputElement;
			if (target.files && target.files.length > 0) {
				const file = target.files[0];
				this.bookService.uploadCover(this.id(), file, title).subscribe({
					next: () => {
						this.notificationService.success(
							'Nova capa enviada com sucesso!',
							'Capa Adicionada',
						);
						this.loadCovers();
					},
					error: (err) => {
						console.error('Error uploading cover:', err);
						this.notificationService.error(
							'Erro ao enviar nova capa.',
						);
					},
				});
			}
		};
		fileInput.click();
	}

	correctCover() {
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: PromptModalComponent,
			componentData: {
				title: 'Capturar Capa por URL',
				message: 'Informe a URL da imagem externa:',
				placeholder: 'https://...',
				value: '',
				close: (url: string | null) => {
					this.modalService.close();
					if (url && url.trim().length > 0) {
						this.promptForScrapeTitle(url.trim());
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	private promptForScrapeTitle(url: string) {
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: PromptModalComponent,
			componentData: {
				title: 'Nome da Capa',
				message: 'Informe um nome para esta nova capa:',
				placeholder: 'Ex: Capa Alternativa...',
				value: '',
				close: (title: string | null) => {
					this.modalService.close();
					if (title !== null) {
						this.bookService
							.scrapeCover(this.id(), url, title.trim())
							.subscribe({
								next: () => {
									this.notificationService.success(
										'Tarefa de captura de capa agendada.',
										'Processando',
									);
									// O backend geralmente processa isso via job,
									// mas vamos recarregar para ver se já aparece algo
									setTimeout(() => this.loadCovers(), 2000);
								},
								error: (err: Error) => {
									console.error('Error scraping cover:', err);
									this.notificationService.error(
										'Erro ao agendar captura de capa.',
									);
								},
							});
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	fixCovers() {
		const bookTitle = this.bookBasic()?.title || 'este livro';
		this.modalService.show(
			'Corrigir Capas',
			`Deseja tentar corrigir automaticamente as capas do livro "${bookTitle}"?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Corrigir',
					type: 'danger',
					callback: () => {
						this.bookService.fixAllCovers(this.id()).subscribe({
							next: () => {
								this.notificationService.success(
									'Tarefa de correção de capas agendada.',
									'Processando',
								);
								this.modalService.close();
							},
							error: (err) => {
								console.error('Error fixing covers:', err);
								this.notificationService.error(
									'Erro ao agendar correção de capas.',
								);
								this.modalService.close();
							},
						});
					},
				},
			],
			'info',
		);
	}

	fixSpecificCover(cover: Cover) {
		this.modalService.show(
			'Corrigir Capa',
			`Deseja tentar corrigir automaticamente a capa "${cover.title || cover.id}"?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Corrigir',
					type: 'danger',
					callback: () => {
						this.bookService
							.fixCover(this.id(), cover.id)
							.subscribe({
								next: () => {
									this.notificationService.success(
										'Tarefa de correção da capa agendada.',
										'Processando',
									);
									this.modalService.close();
								},
								error: (err) => {
									console.error('Error fixing cover:', err);
									this.notificationService.error(
										'Erro ao agendar correção da capa.',
									);
									this.modalService.close();
								},
							});
					},
				},
			],
			'info',
		);
	}
}
