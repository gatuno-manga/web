import {
	Component,
	signal,
	OnDestroy,
	OnInit,
	inject,
	computed,
	ViewChild,
	ElementRef,
	AfterViewInit,
	NgZone,
} from '@angular/core';
import { LocalStorageService } from '../../service/local-storage.service';
import { BookService } from '../../service/book.service';
import {
	BookList,
	BookPageOptions,
	ScrapingStatus,
	TypeBook,
	BookFilterInput,
} from '../../models/book.models';
import {
	BookListSettings,
	DEFAULT_BOOK_LIST_SETTINGS,
} from '../../models/settings.models';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ItemBookComponent } from '../../components/item-book/item-book.component';
import { Page } from '../../models/miscellaneous.models';

import { SelectComponent } from '../../components/select/select.component';
import { MetaDataService } from '../../service/meta-data.service';
import { DownloadService } from '../../service/download.service';
import { SensitiveContentService } from '../../service/sensitive-content.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { NetworkStatusService } from '../../service/network-status.service';
import { BookFilterComponent } from '../../components/book-filter/book-filter.component';

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
	imports: [
		RouterModule,
		ItemBookComponent,
		SelectComponent,
		BookFilterComponent,
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
	private modalService = inject(ModalNotificationService);
	private networkStatus = inject(NetworkStatusService);
	private ngZone = inject(NgZone);

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
	@ViewChild('scrollAnchor') set scrollAnchor(element: ElementRef | undefined) {
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

		this.route.queryParams.subscribe((rawParams) => {
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
					filters.publicationOperator = params.publicationOperator;
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
		this.clearCoverUrls();
		if (this.observer) {
			this.observer.disconnect();
		}
	}

	ngAfterViewInit() {
		this.setupInfiniteScroll();
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
					this.hasNextPage
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

			// Manually trigger a check if the anchor is visible after loading
			if (this.hasNextPage && this.listSettings.listMode === 'infinite-scroll') {
				setTimeout(() => {
					if (this.scrollAnchor && !this.isLoading() && this.hasNextPage) {
						const rect = this.scrollAnchor.nativeElement.getBoundingClientRect();
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
		const gqlFilter: BookFilterInput = {
			page: this.currentPage,
			limit: this.listSettings.limit,
			search: this.filterOptions.search,
			sensitiveContent: this.filterOptions.sensitiveContent,
			type: this.filterOptions.type?.map((t) => t.toUpperCase()) as any,
			tags: this.filterOptions.tags,
			tagsLogic: this.filterOptions.tagsLogic?.toUpperCase() as any,
			excludeTags: this.filterOptions.excludeTags,
			excludeTagsLogic: this.filterOptions.excludeTagsLogic?.toUpperCase() as any,
			authors: this.filterOptions.authors,
			authorsLogic: this.filterOptions.authorsLogic?.toUpperCase() as any,
			publication: this.filterOptions.publication,
			publicationOperator: this.filterOptions.publicationOperator?.toUpperCase() as any,
			orderBy: this.filterOptions.orderBy
				?.replace(/[A-Z]/g, '_$&')
				.toUpperCase() as any,
			order: this.filterOptions.order as any,
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

				// Manually trigger a check if the anchor is visible after loading
				if (this.hasNextPage && this.listSettings.listMode === 'infinite-scroll') {
					setTimeout(() => {
						if (this.scrollAnchor && !this.isLoading() && this.hasNextPage) {
							const rect = this.scrollAnchor.nativeElement.getBoundingClientRect();
							const isInView = rect.top <= window.innerHeight + 200;
							if (isInView) this.loadMore();
						}
					}, 100);
				}
			},
			error: () => {
				console.log('Online GraphQL load failed, falling back to offline view');
				this.viewMode = 'offline';
				this.loadOfflineBooks();
			},
		});
	}

	getPagesToShow(): number[] {
		const pages = new Set<number>();
		pages.add(1);
		pages.add(this.lastPage);

		for (let i = this.currentPage - 2; i <= this.currentPage + 2; i++) {
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
