import { isPlatformBrowser } from '@angular/common';
import {
	AfterViewInit,
	Component,
	ElementRef,
	effect,
	inject,
	NgZone,
	OnDestroy,
	OnInit,
	PLATFORM_ID,
	signal,
	ViewChild,
} from '@angular/core';
import {
	ActivatedRoute,
	NavigationStart,
	Router,
	RouterModule,
} from '@angular/router';
import { BookService } from '@core/services/book.service';
import { DownloadService } from '@core/services/download.service';
import { LocalStorageService } from '@core/services/local-storage.service';
import { MetaDataService } from '@core/services/meta-data.service';
import { ModalNotificationService } from '@core/services/modal-notification.service';
import { NetworkStatusService } from '@core/services/network-status.service';
import {
	ScrollRestorationService,
	ScrollRestorationState,
} from '@core/services/scroll-restoration.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { TagsService } from '@core/services/tags.service';
import { BookFilterComponent } from '@features/books/components/book-filter/book-filter.component';
import {
	BookFilterInput,
	BookList,
	BookPageOptions,
	ScrapingStatus,
	TypeBook,
} from '@models/book.models';
import {
	BookListSettings,
	DEFAULT_BOOK_LIST_SETTINGS,
} from '@models/settings.models';
import { SelectCycleComponent } from '@ui/atoms/select/select-cycle.component';
import { BookGridComponent } from '@ui/organisms/book-grid/book-grid.component';
import { distinctUntilChanged, Subscription } from 'rxjs';

interface BookQueryParams {
	page?: string;
	mode?: string;
	type?: TypeBook | TypeBook[];
	tags?: string | string[];
	tagsLogic?: 'and' | 'or';
	excludeTags?: string | string[];
	excludeTagsLogic?: 'and' | 'or';
	authors?: string | string[];
	authorsLogic?: 'and' | 'or';
	publication?: string;
	publicationOperator?: 'eq' | 'gt' | 'lt' | 'gte' | 'lte';
	orderBy?: 'title' | 'createdAt' | 'updatedAt' | 'publication';
	order?: 'ASC' | 'DESC';
	search?: string;
	sensitiveContent?: string | string[];
}

@Component({
	selector: 'app-books',
	standalone: true,
	imports: [
		RouterModule,
		SelectCycleComponent,
		BookFilterComponent,
		BookGridComponent,
	],
	templateUrl: './books.component.html',
	styleUrl: './books.component.scss',
})
export class BooksComponent implements OnInit, OnDestroy, AfterViewInit {
	private localStorage = inject(LocalStorageService);
	private bookService = inject(BookService);
	private router = inject(Router);
	private route = inject(ActivatedRoute);
	private metaService = inject(MetaDataService);
	private downloadService = inject(DownloadService);
	private sensitiveContentService = inject(SensitiveContentService);
	private tagsService = inject(TagsService);
	private modalService = inject(ModalNotificationService);
	private networkStatus = inject(NetworkStatusService);
	private ngZone = inject(NgZone);
	private scrollRestoration = inject(ScrollRestorationService);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly isBrowser = isPlatformBrowser(this.platformId);

	/** Key used to store/retrieve scroll position in sessionStorage */
	private readonly scrollKey = 'books-list';
	/** Pending scroll/page state to restore after books are rendered */
	private pendingRestoreState: ScrollRestorationState | null = null;
	/** Debounce timer for scroll position saving */
	private scrollSaveTimer: ReturnType<typeof setTimeout> | null = null;
	/** Bound scroll handler so it can be removed on destroy */
	private lastScrollY = 0;
	private readonly onScroll = (event: Event) => {
		const target = event.target as HTMLElement | Document;
		this.lastScrollY =
			target instanceof Document
				? window.scrollY
				: (target as HTMLElement).scrollTop;
		this.scheduleScrollSave();
	};
	private routerEventsSub?: Subscription;

	constructor() {
		// Re-load books when global filters change (sensitive content / excluded tags).
		//
		// WHY effectRunCount instead of an `initialized` class field:
		// The Angular effect() ALWAYS executes once on init to register signal
		// dependencies. route.queryParams emits SYNCHRONOUSLY on subscribe (inside
		// ngOnInit), so by the time the effect() runs its first tick (next CD cycle),
		// any class-level `initialized` flag would already be `true` — causing a
		// duplicate load. A closure-local counter is deterministic: run 1 is always
		// the dependency-registration run, run 2+ are genuine signal changes.
		let effectRunCount = 0;
		effect(() => {
			this.sensitiveContentService.allowContentSignal();
			this.tagsService.excludedTagsSignal();

			if (effectRunCount++ === 0) return; // skip first (dependency-tracking) run

			this.ngZone.run(() => {
				this.loadBooks();
			});
		});
	}

	books: BookList[] = [];
	currentPage = 1;
	lastPage = 1;
	hasNextPage = false;
	pagesToShow: number[] = [];
	isLoading = signal(true);
	bookOptions: 'grid' | 'list' | 'cover' = 'grid';
	viewMode: 'online' | 'offline' = 'online';
	isOfflineMode = false;
	filterOptions: BookPageOptions = {};
	listSettings: BookListSettings = DEFAULT_BOOK_LIST_SETTINGS;
	private coverUrls: string[] = [];
	private observer: IntersectionObserver | null = null;

	private _scrollAnchor?: ElementRef;
	@ViewChild('scrollAnchor') set scrollAnchor(element:
		| ElementRef
		| undefined,) {
		this._scrollAnchor = element;
		if (element && this.observer) {
			this.observer.disconnect();
			this.observer.observe(element.nativeElement);
		}
	}

	get scrollAnchor(): ElementRef | undefined {
		return this._scrollAnchor;
	}

	selectList = [
		{
			icon: 'grid',
			value: 'grid',
			checked: () => this.setBookOptions('grid'),
		},
		{
			icon: 'list',
			value: 'list',
			checked: () => this.setBookOptions('list'),
		},
		{
			icon: 'image',
			value: 'cover',
			checked: () => this.setBookOptions('cover'),
		},
	];

	viewModeList = [
		{
			icon: 'globe',
			checked: () => this.toggleViewMode('online'),
		},
		{
			icon: 'download',
			checked: () => this.toggleViewMode('offline'),
		},
	];

	ngOnInit() {
		this.listSettings =
			this.localStorage.get<BookListSettings>('book-list-settings') ||
			DEFAULT_BOOK_LIST_SETTINGS;

		const savedLayout = this.localStorage.get('books-layout');
		if (
			savedLayout === 'grid' ||
			savedLayout === 'list' ||
			savedLayout === 'cover'
		) {
			this.bookOptions = savedLayout;
		}

		this.restoreScrollIfNeeded();

		this.routerEventsSub = this.router.events.subscribe((event) => {
			if (event instanceof NavigationStart) {
				this.saveScrollPosition();
			}
		});

		this.route.queryParams
			.pipe(
				distinctUntilChanged(
					(a, b) => JSON.stringify(a) === JSON.stringify(b),
				),
			)
			.subscribe((rawParams) => {
				const params = rawParams as BookQueryParams;
				const pageFromUrl = params.page
					? Number.parseInt(params.page, 10)
					: 1;

				if (
					this.listSettings.listMode === 'infinite-scroll' &&
					(!params.page || pageFromUrl === 1)
				) {
					this.books = [];
				}

				this.currentPage = pageFromUrl > 0 ? pageFromUrl : 1;

				this.isOfflineMode = this.networkStatus.isOffline();

				if (this.isOfflineMode) {
					this.viewMode = 'offline';
				} else {
					if (params.mode === 'offline') {
						this.viewMode = 'offline';
					} else {
						this.viewMode = 'online';
					}
				}

				const filters: BookPageOptions = {
					page: this.currentPage,
					limit: this.listSettings.limit,
				};

				// Only apply these filters in online mode
				if (this.viewMode === 'online') {
					if (params.type)
						filters.type = Array.isArray(params.type)
							? params.type
							: [params.type];
					if (params.tags)
						filters.tags = Array.isArray(params.tags)
							? params.tags
							: [params.tags];
					if (params.tagsLogic) filters.tagsLogic = params.tagsLogic;
					if (params.excludeTags)
						filters.excludeTags = Array.isArray(params.excludeTags)
							? params.excludeTags
							: [params.excludeTags];
					if (params.excludeTagsLogic)
						filters.excludeTagsLogic = params.excludeTagsLogic;
					if (params.authors)
						filters.authors = Array.isArray(params.authors)
							? params.authors
							: [params.authors];
					if (params.authorsLogic)
						filters.authorsLogic = params.authorsLogic;
					if (params.publication)
						filters.publication = Number.parseInt(
							params.publication,
							10,
						);
					if (params.publicationOperator)
						filters.publicationOperator =
							params.publicationOperator;
					if (params.orderBy) filters.orderBy = params.orderBy;
					if (params.order) filters.order = params.order;
				}

				// These filters work in both modes
				if (params.search) filters.search = params.search;
				if (params.sensitiveContent)
					filters.sensitiveContent = Array.isArray(
						params.sensitiveContent,
					)
						? params.sensitiveContent
						: [params.sensitiveContent];

				this.filterOptions = filters;

				this.loadBooks();
			});
		this.setMetaData();
	}

	ngOnDestroy() {
		if (this.isBrowser) {
			window.removeEventListener('scroll', this.onScroll, {
				capture: true,
			} as any);
		}
		if (this.scrollSaveTimer !== null) {
			clearTimeout(this.scrollSaveTimer);
		}
		this.routerEventsSub?.unsubscribe();
		this.clearCoverUrls();
		if (this.observer) {
			this.observer.disconnect();
		}
	}

	ngAfterViewInit() {
		this.setupInfiniteScroll();
		if (!this.isBrowser) return;
		// Listen to scroll events to continuously save the position.
		// We use a native listener (outside NgZone) to avoid triggering
		// unnecessary change detection on every scroll event.
		// Use capture: true to catch scroll events from <main> or any inner container
		this.ngZone.runOutsideAngular(() => {
			window.addEventListener('scroll', this.onScroll, {
				passive: true,
				capture: true,
			});
		});
	}

	/**
	 * Schedules a debounced save of the current scroll position.
	 * Using debounce (150ms) avoids writing to sessionStorage on every pixel scrolled.
	 */
	private scheduleScrollSave(): void {
		if (this.scrollSaveTimer !== null) {
			clearTimeout(this.scrollSaveTimer);
		}
		this.scrollSaveTimer = setTimeout(() => {
			this.saveScrollPosition();
			this.scrollSaveTimer = null;
		}, 150);
	}

	/**
	 * Persists the current scroll position (and infinite-scroll page state)
	 * so it can be restored when the user navigates back.
	 */
	private saveScrollPosition(): void {
		if (this.pendingRestoreState) return;
		const extra: Partial<ScrollRestorationState> = {
			scrollY: this.lastScrollY,
		};
		if (this.listSettings.listMode === 'infinite-scroll') {
			extra.infiniteScrollPage = this.currentPage;
		}
		this.scrollRestoration.save(this.scrollKey, extra);
	}

	/**
	 * Checks if there is a saved scroll position and, if so, schedules
	 * it to be applied after the initial book load completes.
	 *
	 * For infinite-scroll mode: when multiple pages were loaded previously,
	 * we trigger sequential page loads until we reach the saved page count,
	 * then restore the scroll position.
	 */
	private restoreScrollIfNeeded(): void {
		const state = this.scrollRestoration.get(this.scrollKey);
		if (!state || state.scrollY <= 0) return;

		// Save the state. The actual loading of additional pages and scrolling
		// will be handled by applyPendingScrollRestore() after each loadBooks()
		// completes, ensuring we don't have overlapping requests.
		this.pendingRestoreState = state;
	}

	/**
	 * Sequentially loads pages from (currentPage + 1) up to targetPage,
	 * used exclusively during scroll restoration in infinite-scroll mode.
	 */
	private loadPagesUpTo(targetPage: number): void {
		if (this.currentPage >= targetPage) return;
		this.currentPage++;
		this.loadBooks();
		// The next iteration is triggered from applyPendingScrollRestore once
		// isLoading becomes false — we check hasNextPage there instead of
		// calling this recursively, to avoid blocking the event loop.
	}

	setupInfiniteScroll() {
		if (this.listSettings.listMode !== 'infinite-scroll') return;

		if (this.observer) {
			this.observer.disconnect();
		}

		this.observer = new IntersectionObserver(
			(entries) => {
				if (
					entries[0].isIntersecting &&
					!this.isLoading() &&
					this.hasNextPage &&
					// Don't let the observer fire during scroll restoration;
					// page loading is driven by applyPendingScrollRestore instead.
					!this.pendingRestoreState
				) {
					this.ngZone.run(() => {
						this.loadMore();
					});
				}
			},
			{
				threshold: 0.1,
				rootMargin: '200px',
			},
		);

		if (this.scrollAnchor) {
			this.observer.observe(this.scrollAnchor.nativeElement);
		}
	}

	loadMore() {
		if (this.isLoading() || !this.hasNextPage) return;
		this.currentPage++;
		this.loadBooks();
	}

	clearCoverUrls() {
		for (const url of this.coverUrls) {
			URL.revokeObjectURL(url);
		}
		this.coverUrls = [];
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Livros',
			description:
				'Navegue por nossa coleção de livros. Encontre títulos por gênero, autor e mais.',
		});
	}

	setBookOptions(option: 'grid' | 'list' | 'cover') {
		const previousOption = this.bookOptions;
		this.bookOptions = option;
		this.localStorage.set('books-layout', option);

		// Se mudou para 'list', precisamos garantir que temos as descrições para todos os itens
		if (option === 'list' && previousOption !== 'list') {
			this.currentPage = 1;
			this.books = [];
			this.loadBooks();
		} else {
			// Força atualização das referências para garantir que o OnPush detecte a mudança de 'type'
			this.books = [...this.books];
		}
	}

	toggleViewMode(mode: 'online' | 'offline') {
		if (this.viewMode === mode) return;

		if (mode === 'online' && this.networkStatus.isOffline()) {
			this.modalService.show(
				'Sem conexão',
				'Você está sem internet. Não é possível acessar a biblioteca online.',
				[{ label: 'Ok', type: 'primary' }],
				'warning',
			);
			return;
		}

		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: {
				...this.route.snapshot.queryParams,
				mode: mode === 'online' ? null : 'offline',
				page: 1,
			},
			queryParamsHandling: 'merge',
		});
	}

	loadBooks() {
		this.isLoading.set(true);
		if (this.viewMode === 'offline') {
			this.loadOfflineBooks();
		} else {
			this.loadOnlineBooks();
		}
	}

	async loadOfflineBooks() {
		try {
			const offlineBooks = await this.downloadService.getAllBooks();

			let filtered = offlineBooks;
			if (this.filterOptions.search) {
				const search = this.filterOptions.search.toLowerCase();
				filtered = filtered.filter((b) =>
					b.title.toLowerCase().includes(search),
				);
			}

			let allowedSensitiveContent = this.filterOptions.sensitiveContent;
			if (!allowedSensitiveContent) {
				allowedSensitiveContent =
					this.sensitiveContentService.getContentAllow();
			}

			const allowedSet = new Set(allowedSensitiveContent);

			filtered = filtered.filter((b) => {
				if (!b.sensitiveContent || b.sensitiveContent.length === 0)
					return true;
				return b.sensitiveContent.every((sc) =>
					allowedSet.has(sc.name),
				);
			});

			const total = filtered.length;
			const limit = this.filterOptions.limit || 20;
			const page = this.currentPage;
			const start = (page - 1) * limit;
			const end = start + limit;
			const paginated = filtered.slice(start, end);

			this.clearCoverUrls();

			const newBooks = paginated.map((ob) => {
				const url = URL.createObjectURL(ob.cover);
				this.coverUrls.push(url);
				return {
					id: ob.id,
					title: ob.title,
					cover: url,
					tags: ob.tags || [],
					description: ob.description || '',
					scrapingStatus: ScrapingStatus.READY,
					publication: ob.publication,
					authors: ob.authors || [],
					totalChapters: ob.totalChapters,
					blurHash: ob.blurHash,
					dominantColor: ob.dominantColor,
				} as BookList;
			});

			if (
				this.listSettings.listMode === 'infinite-scroll' &&
				this.currentPage > 1
			) {
				this.books = [...this.books, ...newBooks];
			} else {
				this.books = newBooks;
			}

			this.lastPage = Math.ceil(total / limit) || 1;
			this.hasNextPage = this.currentPage < this.lastPage;
			this.pagesToShow = this.getPagesToShow();

			this.applyPendingScrollRestore();

			// Manually trigger a check if the anchor is visible after loading
			if (
				this.hasNextPage &&
				this.listSettings.listMode === 'infinite-scroll'
			) {
				setTimeout(() => {
					if (
						this.scrollAnchor &&
						!this.isLoading() &&
						this.hasNextPage
					) {
						const rect =
							this.scrollAnchor.nativeElement.getBoundingClientRect();
						const isInView = rect.top <= window.innerHeight + 200;
						if (isInView) this.loadMore();
					}
				}, 100);
			}
		} catch (err) {
			console.error('Error loading offline books:', err);
		} finally {
			this.isLoading.set(false);
		}
	}

	loadOnlineBooks() {
		let allowedSensitiveContent = this.filterOptions.sensitiveContent;

		if (!allowedSensitiveContent) {
			const allowedNames = this.sensitiveContentService.getContentAllow();
			allowedSensitiveContent =
				allowedNames.length > 0 ? ['safe', ...allowedNames] : ['safe'];
		}

		const gqlFilter: BookFilterInput = {
			page: this.currentPage,
			limit: this.listSettings.limit,
			search: this.filterOptions.search,
			sensitiveContent: allowedSensitiveContent,
			type: this.filterOptions.type?.map((t) => t.toUpperCase()),
			tags: this.filterOptions.tags,
			tagsLogic: this.filterOptions.tagsLogic?.toUpperCase() as
				| 'AND'
				| 'OR',
			excludeTags: this.filterOptions.excludeTags,
			excludeTagsLogic:
				this.filterOptions.excludeTagsLogic?.toUpperCase() as
					| 'AND'
					| 'OR',
			authors: this.filterOptions.authors,
			authorsLogic: this.filterOptions.authorsLogic?.toUpperCase() as
				| 'AND'
				| 'OR',
			publication: this.filterOptions.publication,
			publicationOperator:
				this.filterOptions.publicationOperator?.toUpperCase() as
					| 'EQ'
					| 'GT'
					| 'GTE'
					| 'LT'
					| 'LTE',
			orderBy: this.filterOptions.orderBy
				?.replace(/[A-Z]/g, '_$&')
				.toUpperCase() as
				| 'CREATED_AT'
				| 'PUBLICATION'
				| 'TITLE'
				| 'UPDATED_AT',
			order: this.filterOptions.order,
		};

		const fields = ['id', 'title'];
		if (this.bookOptions === 'list') {
			fields.push('description');
		}
		// Always include 'cover' to trigger 'covers' mapping in service
		fields.push('cover');

		this.bookService.getBooksGraphQL(gqlFilter, fields).subscribe({
			next: (bookPage) => {
				const newBooks = bookPage.data;

				if (
					this.listSettings.listMode === 'infinite-scroll' &&
					this.currentPage > 1
				) {
					// Quando carregando mais no infinite scroll, apenas adicionamos
					this.books = [...this.books, ...newBooks];
				} else {
					// Substituímos a lista para garantir que as referências sejam novas
					this.books = [...newBooks];
				}

				this.currentPage = bookPage.page || this.currentPage;
				this.lastPage = bookPage.lastPage || 1;
				this.hasNextPage = this.currentPage < this.lastPage;
				this.pagesToShow = this.getPagesToShow();
				this.isLoading.set(false);

				this.applyPendingScrollRestore();

				// Manually trigger a check if the anchor is visible after loading
				if (
					this.hasNextPage &&
					this.listSettings.listMode === 'infinite-scroll'
				) {
					setTimeout(() => {
						if (
							this.scrollAnchor &&
							!this.isLoading() &&
							this.hasNextPage
						) {
							const rect =
								this.scrollAnchor.nativeElement.getBoundingClientRect();
							const isInView =
								rect.top <= window.innerHeight + 200;
							if (isInView) this.loadMore();
						}
					}, 100);
				}
			},
			error: () => {
				console.log(
					'Online GraphQL load failed, falling back to offline view',
				);
				this.viewMode = 'offline';
				this.loadOfflineBooks();
			},
		});
	}

	/**
	 * If a scroll restore is pending and we are not loading more pages,
	 * applies it and clears the pending state.
	 *
	 * For infinite-scroll: if more pages still need loading before reaching
	 * the target, triggers the next page load instead of scrolling.
	 */
	private applyPendingScrollRestore(): void {
		if (!this.pendingRestoreState) return;
		if (this.isLoading()) return;

		const { scrollY, infiniteScrollPage } = this.pendingRestoreState;

		// In infinite-scroll mode, keep loading pages until we reach the target
		if (
			this.listSettings.listMode === 'infinite-scroll' &&
			infiniteScrollPage &&
			this.currentPage < infiniteScrollPage &&
			this.hasNextPage
		) {
			this.loadPagesUpTo(infiniteScrollPage);
			return;
		}

		this.pendingRestoreState = null;
		// Consume the saved state so it won't be re-applied on future visits
		this.scrollRestoration.consume(this.scrollKey);
		this.scrollRestoration.restoreAfterRender(scrollY);
	}

	getPagesToShow(): number[] {
		const pages = new Set<number>();
		pages.add(1);
		pages.add(this.lastPage);

		const isMobile =
			typeof window !== 'undefined' && window.innerWidth < 600;
		const range = isMobile ? 1 : 2;

		for (
			let i = this.currentPage - range;
			i <= this.currentPage + range;
			i++
		) {
			if (i > 1 && i < this.lastPage) {
				pages.add(i);
			}
		}

		return Array.from(pages).sort((a, b) => a - b);
	}

	goToPage(page: number) {
		if (page !== this.currentPage && page >= 1 && page <= this.lastPage) {
			const cleanParams = Object.fromEntries(
				Object.entries({ ...this.filterOptions, page }).filter(
					([_, value]) => value !== undefined,
				),
			);

			this.router.navigate([], {
				relativeTo: this.route,
				queryParams: cleanParams,
				queryParamsHandling: 'merge',
			});
		}
	}

	selectListItem(): number {
		return this.selectList.findIndex(
			(item) => item.value === this.bookOptions,
		);
	}

	getViewModeIndex(): number {
		return this.viewMode === 'online' ? 0 : 1;
	}

	onFiltersChange(filters: Partial<BookPageOptions>) {
		// Check if all filters are empty (clearing filters)
		const hasAnyFilter = Object.keys(filters).some((key) => {
			const value = filters[key as keyof BookPageOptions];
			if (value === undefined || value === null || value === '')
				return false;
			if (Array.isArray(value) && value.length === 0) return false;
			return true;
		});

		// If no filters, navigate with only page=1
		if (!hasAnyFilter) {
			this.router.navigate([], {
				relativeTo: this.route,
				queryParams: { page: 1 },
				queryParamsHandling: '',
			});
			return;
		}

		// Only keep filters that work in current mode
		const applicableFilters: Partial<BookPageOptions> = { page: 1 };

		// These filters work in both modes
		if (filters.search) applicableFilters.search = filters.search;
		if (filters.sensitiveContent)
			applicableFilters.sensitiveContent = filters.sensitiveContent;

		// These filters only work in online mode
		if (this.viewMode === 'online') {
			if (filters.type) applicableFilters.type = filters.type;
			if (filters.tags) {
				applicableFilters.tags = filters.tags;
				applicableFilters.tagsLogic = filters.tagsLogic;
			}
			if (filters.excludeTags) {
				applicableFilters.excludeTags = filters.excludeTags;
				applicableFilters.excludeTagsLogic = filters.excludeTagsLogic;
			}
			if (filters.authors) {
				applicableFilters.authors = filters.authors;
				applicableFilters.authorsLogic = filters.authorsLogic;
			}
			if (filters.publication) {
				applicableFilters.publication = filters.publication;
				applicableFilters.publicationOperator =
					filters.publicationOperator;
			}
			if (filters.orderBy) {
				applicableFilters.orderBy = filters.orderBy;
				applicableFilters.order = filters.order;
			}
		}

		const cleanParams = Object.fromEntries(
			Object.entries(applicableFilters).filter(
				([_, value]) =>
					value !== undefined &&
					value !== '' &&
					(Array.isArray(value) ? value.length > 0 : true),
			),
		);

		if (filters.random) {
			this.bookService.randomBook(cleanParams).subscribe((book) => {
				this.router.navigate(['/books', book.id]);
			});
		} else {
			this.router.navigate([], {
				relativeTo: this.route,
				queryParams: cleanParams,
				queryParamsHandling: '',
			});
		}
	}
}
