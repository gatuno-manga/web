import {
	Component,
	ElementRef,
	OnInit,
	OnDestroy,
	inject,
	signal,
	viewChild,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	computed,
	DestroyRef,
	effect,
	AfterViewInit,
	PLATFORM_ID,
	afterNextRender,
	Injector,
	ViewChild,
	NgZone,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
	Chapter,
	ContentType,
	Page,
} from '../../models/book.models';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconsComponent } from '../../components/icons/icons.component';
import { DecimalPipe, NgClass } from '@angular/common';
import { ChapterService } from '../../service/chapter.service';
import { UserTokenService } from '../../service/user-token.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { NotificationService } from '../../service/notification.service';
import { ButtonComponent } from '../../components/inputs/button/button.component';
import { AsideComponent } from '../../components/aside/aside.component';
import { MetaDataService } from '../../service/meta-data.service';
import { SettingsService } from '../../service/settings.service';
import { NotificationSeverity } from 'app/service/notification';
import { ReaderSettingsNotificationComponent } from '@components/notification/custom-components';
import { PromptModalComponent } from '@components/notification/custom-components/prompt-modal/prompt-modal.component';
import { BookWebsocketService } from '../../service/book-websocket.service';
import { DownloadService } from '../../service/download.service';
import { UnifiedReadingProgressService } from '../../service/unified-reading-progress.service';
import { NetworkStatusService } from '../../service/network-status.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, lastValueFrom } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { ContextMenuService } from '../../service/context-menu.service';
import { ContextMenuItem } from '../../models/context-menu.models';
import { SavedPagesService } from '../../service/saved-pages.service';
import {
	ImageReaderComponent,
	TextReaderComponent,
	DocumentReaderComponent,
	ReadingProgressEvent,
	TextProgressEvent,
	DocumentProgressEvent,
} from '../../components/readers';
import { HeaderStateService } from '../../service/header-state.service';
import { ChapterCommentsComponent } from '../../components/chapter-comments/chapter-comments.component';

type ChapterLoadOrigin =
	| 'route'
	| 'retry-modal'
	| 'refresh'
	| 'context-menu'
	| 'unknown';

type ChapterLoadFailureReason =
	| 'network'
	| 'not-found'
	| 'auth'
	| 'offline-cache-failure'
	| 'unknown';

type ChapterLoadSource = 'online' | 'offline' | 'unknown';

type ChapterLoadFailureDiagnostic = {
	chapterId: string;
	origin: ChapterLoadOrigin;
	reason: ChapterLoadFailureReason;
	source: ChapterLoadSource;
	forceOnline: boolean;
	silent: boolean;
	statusCode?: number;
};

@Component({
	selector: 'app-chapters',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IconsComponent,
		RouterModule,
		NgClass,
		DecimalPipe,
		ButtonComponent,
		AsideComponent,
		ImageReaderComponent,
		TextReaderComponent,
		DocumentReaderComponent,
		ChapterCommentsComponent,
	],
	templateUrl: './chapters.component.html',
	styleUrl: './chapters.component.scss',
})
export class ChaptersComponent implements OnInit, OnDestroy, AfterViewInit {
	private activatedRoute = inject(ActivatedRoute);
	private chapterService = inject(ChapterService);
	private userTokenService = inject(UserTokenService);
	private modalNotificationService = inject(ModalNotificationService);
	private notificationService = inject(NotificationService);
	private metaDataService = inject(MetaDataService);
	private settingsService = inject(SettingsService);
	private bookWebsocketService = inject(BookWebsocketService);
	private downloadService = inject(DownloadService);
	private readingProgressService = inject(UnifiedReadingProgressService);
	private contextMenuService = inject(ContextMenuService);
	private savedPagesService = inject(SavedPagesService);
	private router = inject(Router);
	private platformId = inject(PLATFORM_ID);
	private networkStatus = inject(NetworkStatusService);
	private cdr = inject(ChangeDetectorRef);
	private injector = inject(Injector);
	private headerStateService = inject(HeaderStateService);
	private ngZone = inject(NgZone);

	progressBarRef = viewChild<ElementRef>('progressBarRef');
	@ViewChild(ImageReaderComponent) imageReader?: ImageReaderComponent;
	@ViewChild(TextReaderComponent) textReader?: TextReaderComponent;
	@ViewChild(DocumentReaderComponent)
	documentReader?: DocumentReaderComponent;

	chapter = signal<Chapter | null>(null);
	readingProgress = signal<number>(0);
	showScrollToTopButton = signal<boolean>(false);
	savedPageIndex = signal<number>(0);

	private readonly chapterLoadErrorModalTitle = 'Erro ao carregar capítulo';
	private readonly chapterLoadErrorModalMessage =
		'Erro ao carregar o capítulo.';
	private activeChapterLoadErrorModalId: string | null = null;
	private dismissedChapterLoadErrorModalId: string | null = null;
	private suppressChapterLoadErrorOnClose = true;
	private currentChapterRouteId: string | null = null;
	private currentLoadRequestId = 0;

	private pageObjectUrls: string[] = [];
	private destroyRef = inject(DestroyRef);
	private maxReadPageIndex = 0;
	private isNavigating = false;
	private isDragging = false;
	private lastScrollPosition = 0;

	settings = toSignal(this.settingsService.settings$, {
		initialValue: this.settingsService.getSettings(),
	});

	filterStyle = computed(() => {
		const s = this.settings();
		const parts: string[] = [];
		if (s.brightness != null) parts.push(`brightness(${s.brightness}%)`);
		if (s.contrast != null) parts.push(`contrast(${s.contrast}%)`);
		if (s.grayScale) parts.push('grayscale(100%)');
		if (s.invert != null && s.invert > 0)
			parts.push(`invert(${s.invert}%)`);
		return parts.length > 0 ? parts.join(' ') : 'none';
	});

	admin = this.userTokenService.isAdminSignal;

	constructor() {
		effect(() => {
			const currentModal = this.notificationService.modal();
			const isChapterLoadErrorModal =
				currentModal?.title === this.chapterLoadErrorModalTitle &&
				currentModal.description === this.chapterLoadErrorModalMessage;

			if (
				!isChapterLoadErrorModal &&
				this.activeChapterLoadErrorModalId
			) {
				if (this.suppressChapterLoadErrorOnClose) {
					this.dismissedChapterLoadErrorModalId =
						this.activeChapterLoadErrorModalId;
				}
				this.activeChapterLoadErrorModalId = null;
				this.suppressChapterLoadErrorOnClose = true;
			}
		});

		this.activatedRoute.paramMap
			.pipe(takeUntilDestroyed())
			.subscribe((params) => {
				const chapterId = params.get('chapter');
				const bookId = params.get('id');

				if (chapterId) {
					if (this.currentChapterRouteId !== chapterId) {
						this.currentChapterRouteId = chapterId;
						this.dismissedChapterLoadErrorModalId = null;
					}
					this.loadChapter(chapterId, false, false, 'route');
					if (
						bookId &&
						isPlatformBrowser(this.platformId) &&
						this.userTokenService.hasValidAccessTokenSignal()
					) {
						this.setupWebSocket(chapterId, bookId);
					}
				} else {
					this.backPage();
				}
			});

		afterNextRender(
			() => {
				this.setupScrollListener();
			},
			{ injector: this.injector },
		);
	}

	ngOnInit(): void {
		this.headerStateService.setFixed(true);
	}

	ngAfterViewInit() {
		if (!isPlatformBrowser(this.platformId)) return;
	}

	private setupScrollListener() {
		this.lastScrollPosition =
			window.scrollY || document.documentElement.scrollTop || 0;

		fromEvent(window, 'scroll')
			.pipe(
				throttleTime(50, undefined, { leading: true, trailing: true }),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe(() => {
				const currentScroll =
					window.scrollY || document.documentElement.scrollTop || 0;

				const isScrolledDown = currentScroll > 400;
				const isScrollingUp = currentScroll < this.lastScrollPosition;

				if (isScrolledDown && isScrollingUp) {
					this.showScrollToTopButton.set(true);
				} else {
					this.showScrollToTopButton.set(false);
				}

				this.lastScrollPosition = currentScroll;
				this.cdr.markForCheck();
			});
	}

	ngOnDestroy() {
		this.headerStateService.setFixed(false);
		for (const url of this.pageObjectUrls) {
			URL.revokeObjectURL(url);
		}
	}

	private setupWebSocket(chapterId: string, bookId: string) {
		if (
			!isPlatformBrowser(this.platformId) ||
			!this.userTokenService.hasValidAccessTokenSignal()
		) {
			return;
		}

		this.ngZone.runOutsideAngular(() => {
			if (!this.bookWebsocketService.isConnected()) {
				this.bookWebsocketService.connect();
			}

			this.bookWebsocketService
				.watchChapter(chapterId, bookId)
				.pipe(takeUntilDestroyed(this.destroyRef))
				.subscribe((event) => {
					const typedEvent = event as { type: string; data: unknown };
					if (
						typedEvent.type === 'chapter.updated' ||
						typedEvent.type === 'chapter.scraping.completed'
					) {
						this.ngZone.run(() => this.refreshChapter());
					}
				});
		});
	}

	async loadChapter(
		id: string,
		forceOnline = false,
		silent = false,
		origin: ChapterLoadOrigin = 'unknown',
	) {
		const requestId = ++this.currentLoadRequestId;
		this.maxReadPageIndex = 0;
		try {
			const chapter = await this.resolveChapterData(id, forceOnline);
			if (this.currentLoadRequestId !== requestId) return;

			if (!chapter) {
				const nullFailure = await this.classifyChapterLoadFailureOnNull(
					id,
					forceOnline,
				);
				if (this.currentLoadRequestId !== requestId) return;
				this.reportChapterLoadFailure({
					chapterId: id,
					origin,
					reason: nullFailure.reason,
					source: nullFailure.source,
					forceOnline,
					silent,
				});
				if (!silent) this.showChapterLoadErrorModal(id);
				return;
			}

			this.chapter.set(chapter);
			this.dismissedChapterLoadErrorModalId = null;
			this.updateMetadata(chapter);
			try {
				await this.restoreReadingProgress();
			} catch (e) {
				console.warn('Erro ao restaurar progresso:', e);
			}
		} catch (e) {
			if (this.currentLoadRequestId !== requestId) return;
			const failedRequest = this.classifyChapterLoadFailureFromError(e);
			this.reportChapterLoadFailure(
				{
					chapterId: id,
					origin,
					reason: failedRequest.reason,
					source: failedRequest.source,
					forceOnline,
					silent,
					statusCode: failedRequest.statusCode,
				},
				e,
			);
			if (!silent) this.showChapterLoadErrorModal(id);
		}
	}

	private async resolveChapterData(
		id: string,
		forceOnline: boolean,
	): Promise<Chapter | null> {
		if (!forceOnline) {
			const isDownloaded =
				await this.downloadService.isChapterDownloaded(id);
			if (isDownloaded) {
				return this.loadOfflineChapter(id);
			}
		}
		return lastValueFrom(this.chapterService.getChapter(id));
	}

	private async classifyChapterLoadFailureOnNull(
		chapterId: string,
		forceOnline: boolean,
	): Promise<{
		reason: ChapterLoadFailureReason;
		source: ChapterLoadSource;
	}> {
		if (!forceOnline) {
			const isDownloaded =
				await this.downloadService.isChapterDownloaded(chapterId);
			if (isDownloaded) {
				return {
					reason: 'offline-cache-failure',
					source: 'offline',
				};
			}
		}

		if (this.networkStatus.isOffline()) {
			return {
				reason: 'network',
				source: 'online',
			};
		}

		return {
			reason: 'unknown',
			source: forceOnline ? 'online' : 'unknown',
		};
	}

	private classifyChapterLoadFailureFromError(error: unknown): {
		reason: ChapterLoadFailureReason;
		source: ChapterLoadSource;
		statusCode?: number;
	} {
		const HTTP_ERROR_MAP: Record<number, ChapterLoadFailureReason> = {
			404: 'not-found',
			401: 'auth',
			403: 'auth',
			0: 'network',
		};

		if (error instanceof HttpErrorResponse) {
			const reason = HTTP_ERROR_MAP[error.status] || 'unknown';
			return {
				reason,
				source: 'online',
				statusCode: error.status,
			};
		}

		if (this.networkStatus.isOffline()) {
			return {
				reason: 'network',
				source: 'unknown',
			};
		}

		return {
			reason: 'unknown',
			source: 'unknown',
		};
	}

	private reportChapterLoadFailure(
		diagnostic: ChapterLoadFailureDiagnostic,
		error?: unknown,
	): void {
		const summary = `[chapter=${diagnostic.chapterId}] reason=${diagnostic.reason} source=${diagnostic.source} origin=${diagnostic.origin} forceOnline=${diagnostic.forceOnline} silent=${diagnostic.silent}${
			diagnostic.statusCode !== undefined
				? ` status=${diagnostic.statusCode}`
				: ''
		}`;

		if (error !== undefined) {
			console.error(
				'Erro ao carregar capítulo',
				summary,
				diagnostic,
				error,
			);
			return;
		}

		console.error('Erro ao carregar capítulo', summary, diagnostic);
	}

	private showChapterLoadErrorModal(chapterId: string): void {
		if (
			this.activeChapterLoadErrorModalId === chapterId ||
			this.dismissedChapterLoadErrorModalId === chapterId
		) {
			return;
		}

		this.activeChapterLoadErrorModalId = chapterId;
		this.suppressChapterLoadErrorOnClose = true;

		this.modalNotificationService.show(
			this.chapterLoadErrorModalTitle,
			this.chapterLoadErrorModalMessage,
			[
				{
					label: 'Tentar novamente',
					type: 'primary',
					callback: () => {
						this.activeChapterLoadErrorModalId = null;
						this.suppressChapterLoadErrorOnClose = false;
						this.dismissedChapterLoadErrorModalId = null;
						void this.loadChapter(
							chapterId,
							true,
							false,
							'retry-modal',
						);
					},
				},
				{
					label: 'Voltar',
					type: 'secondary',
					callback: () => {
						this.activeChapterLoadErrorModalId = null;
						this.backPage();
					},
				},
			],
			'error',
		);
	}

	private async loadOfflineChapter(id: string): Promise<Chapter | null> {
		try {
			const offlineChapter = await this.downloadService.getChapter(id);
			if (!offlineChapter) return null;

			for (const url of this.pageObjectUrls) {
				URL.revokeObjectURL(url);
			}
			this.pageObjectUrls = [];

			const pages = offlineChapter.pages.map((blob, index) => {
				const url = URL.createObjectURL(blob);
				this.pageObjectUrls.push(url);
				return { index: index.toString(), path: url };
			});

			const offlineBook = await this.downloadService.getBook(
				offlineChapter.bookId,
			);

			return {
				id: offlineChapter.id,
				bookId: offlineChapter.bookId,
				title: offlineChapter.title,
				index: offlineChapter.index,
				pages: pages,
				bookTitle: offlineBook?.title || '',
				totalChapters: offlineBook?.totalChapters || 0,
				originalUrl: '',
				next: offlineChapter.next,
				previous: offlineChapter.previous,
				contentType: offlineChapter.contentType || 'image',
				content: offlineChapter.content,
				contentFormat: offlineChapter.contentFormat,
				documentPath: offlineChapter.document
					? URL.createObjectURL(offlineChapter.document)
					: undefined,
				documentFormat: offlineChapter.documentFormat,
			};
		} catch (e) {
			console.error('Error loading offline chapter', e);
			return null;
		}
	}

	// === Progress handlers for different reader types ===

	private updateProgressState(
		pageIndex: number,
		visualProgressPercentage: number,
	) {
		if (this.isNavigating || this.isDragging) return;

		const currentChapter = this.chapter();
		if (!currentChapter) return;

		// Atualiza progresso visual
		this.readingProgress.set(visualProgressPercentage);

		// Persistência inteligente (apenas se avançou)
		if (pageIndex > this.maxReadPageIndex) {
			this.maxReadPageIndex = pageIndex;
			this.readingProgressService.saveProgress(
				currentChapter.id,
				currentChapter.bookId,
				pageIndex,
			);
		}
	}

	onImageProgress(event: ReadingProgressEvent) {
		const percent =
			event.scrollPercentage !== undefined
				? event.scrollPercentage
				: ((event.pageIndex + 1) / event.totalPages) * 100;
		this.updateProgressState(event.pageIndex, percent);
	}

	onTextProgress(event: TextProgressEvent) {
		this.updateProgressState(event.pageIndex, event.scrollPercentage);
	}

	onDocumentProgress(event: DocumentProgressEvent) {
		const percent =
			event.scrollPercentage !== undefined
				? event.scrollPercentage
				: ((event.pageIndex + 1) / event.totalPages) * 100;
		this.updateProgressState(event.pageIndex, percent);
	}

	getContentType(): ContentType {
		return this.chapter()?.contentType || 'image';
	}
	private updateMetadata(chapter: Chapter) {
		if (chapter) {
			this.metaDataService.setMetaData({
				title: `${chapter.bookTitle} - ${chapter.title || `Capítulo ${chapter.index}`}`,
				description: `Leia o capítulo ${chapter.index} de ${chapter.bookTitle}`,
				image: chapter.pages?.[0]?.path || '',
			});
		}
	}

	refreshChapter() {
		const current = this.chapter();
		if (current) this.loadChapter(current.id, false, true, 'refresh');
	}

	scrollToTop() {
		if (isPlatformBrowser(this.platformId)) {
			window.scrollTo({ top: 0, behavior: 'instant' });
		}
	}

	startDrag(event: MouseEvent | TouchEvent) {
		const progressBar = this.progressBarRef()?.nativeElement;
		if (!progressBar) return;

		this.isDragging = true;

		const calculateProgress = (clientX: number) => {
			const rect = progressBar.getBoundingClientRect();
			const offsetX = clientX - rect.left;
			let percentage = (offsetX / rect.width) * 100;
			percentage = Math.max(0, Math.min(100, percentage));

			this.readingProgress.set(percentage);

			const chapter = this.chapter();
			if (!chapter) return;

			if (chapter.contentType === 'text' && this.textReader) {
				this.textReader.scrollToPercentage(percentage);
			} else if (
				chapter.contentType === 'document' &&
				this.documentReader
			) {
				const total = this.documentReader.getTotalPages();
				const pageIndex = Math.min(
					Math.floor((percentage / 100) * total),
					total - 1,
				);
				this.documentReader.scrollToPage(pageIndex);
			} else if (this.imageReader) {
				const total = chapter.pages?.length || 0;
				if (total > 0) {
					const pageIndex = Math.min(
						Math.floor((percentage / 100) * total),
						total - 1,
					);
					this.imageReader.scrollToPage(pageIndex);
				}
			}
		};

		const onMove = (moveEvent: MouseEvent | TouchEvent) => {
			moveEvent.preventDefault();
			const clientX =
				'touches' in moveEvent
					? moveEvent.touches[0].clientX
					: (moveEvent as MouseEvent).clientX;
			calculateProgress(clientX);
		};

		const onUp = () => {
			this.isDragging = false;
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			document.removeEventListener('touchmove', onMove);
			document.removeEventListener('touchend', onUp);
		};

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
		document.addEventListener('touchmove', onMove, { passive: false });
		document.addEventListener('touchend', onUp);

		const clientX =
			'touches' in event
				? event.touches[0].clientX
				: (event as MouseEvent).clientX;
		calculateProgress(clientX);
	}

	private async restoreReadingProgress() {
		const currentChapter = this.chapter();
		if (!currentChapter) return;

		const progress = await this.readingProgressService.getProgress(
			currentChapter.id,
		);
		const totalPages = currentChapter.pages?.length || 0;
		const savedPageIndex = progress?.pageIndex || 0;

		const isLastPage = savedPageIndex >= totalPages - 1;
		const targetPageIndex = isLastPage ? 0 : savedPageIndex;

		this.maxReadPageIndex = targetPageIndex;
		this.savedPageIndex.set(targetPageIndex);

		if (targetPageIndex > 0) {
			// Delay to ensure readers are rendered and ready
			setTimeout(() => {
				if (this.imageReader) {
					this.imageReader.scrollToPage(targetPageIndex);
				} else if (this.documentReader) {
					this.documentReader.scrollToPage(targetPageIndex);
				} else if (this.textReader) {
					this.textReader.scrollToPage(targetPageIndex);
				}
			}, 200);
		}
	}

	async nextPage() {
		await this.handleChapterTransition('next');
	}

	async previousPage() {
		await this.handleChapterTransition('previous');
	}

	private async handleChapterTransition(direction: 'next' | 'previous') {
		const current = this.chapter();
		if (!current) return;

		const targetChapterId =
			direction === 'next' ? current.next : current.previous;
		if (!targetChapterId) return;

		if (direction === 'next') {
			const isNextDownloaded =
				await this.downloadService.isChapterDownloaded(targetChapterId);
			if (!isNextDownloaded && this.networkStatus.isOffline()) {
				this.modalNotificationService.show(
					'Você chegou ao fim',
					'Você chegou ao último capítulo baixado e está sem internet.',
					[{ label: 'Entendi', type: 'primary' }],
					'warning',
				);
				return;
			}
		}

		await this.markChapterAsCompleted();
		this.navigateToChapter(targetChapterId);
	}

	private async markChapterAsCompleted() {
		this.readingProgressService.cancelPendingSync();

		const current = this.chapter();
		if (current?.pages) {
			const lastPageIndex = current.pages.length - 1;

			await this.readingProgressService.saveProgressImmediate(
				current.id,
				current.bookId,
				lastPageIndex,
				current.pages.length,
				true,
			);
		}
	}

	private navigateToChapter(chapterId: string) {
		this.isNavigating = true;
		this.router
			.navigate(['../', chapterId], { relativeTo: this.activatedRoute })
			.then(() => {
				this.scrollToTop();
				setTimeout(() => {
					this.isNavigating = false;
				}, 500);
			});
	}

	backPage() {
		this.router.navigate(['../'], { relativeTo: this.activatedRoute });
	}

	resetChapter() {
		const current = this.chapter();
		if (current) {
			this.modalNotificationService.show(
				'Redefinir Capítulo',
				'Tem certeza que deseja redefinir este capítulo?',
				[
					{ label: 'Cancelar', type: 'primary' },
					{
						label: 'Redefinir',
						type: 'danger',
						callback: () => {
							this.chapterService
								.resetChapter(current.id)
								.subscribe(() => {
									this.backPage();
								});
						},
					},
				],
				'warning',
			);
		}
	}

	openSettings() {
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: ReaderSettingsNotificationComponent,
			componentData: {
				title: 'Configurações do Leitor',
				subtitle: 'Personalize sua experiência de leitura',
				contentType: this.chapter()?.contentType || 'image',
			},
			useBackdrop: true,
			backdropOpacity: 0.8,
		});
	}

	openOriginalLink() {
		const current = this.chapter();
		if (current?.originalUrl) {
			window.open(current.originalUrl, '_blank');
		}
	}

	onContextMenu(event: MouseEvent, page: Page, index: number) {
		const currentChapter = this.chapter();
		if (!currentChapter) return;

		const items: ContextMenuItem[] = [
			{
				label: 'Baixar Página',
				icon: 'download',
				action: () => {
					const filename = `Page ${index + 1} - Chapter ${currentChapter.index}.jpg`;
					this.downloadService.saveToDevice(page.path, filename);
				},
			},
			{
				label: 'Salvar Página',
				icon: 'bookmark',
				action: () => {
					if (!page.id) {
						this.loadChapter(
							currentChapter.id,
							true,
							false,
							'context-menu',
						).then(() => {
							const updatedChapter = this.chapter();
							if (updatedChapter) {
								const updatedPage = updatedChapter.pages.find(
									(p) => p.index === page.index,
								);
								if (updatedPage?.id) {
									this.savePage(updatedPage, currentChapter);
								} else {
									this.notificationService.warning(
										'Não foi possível obter os dados da página. Verifique sua conexão.',
									);
								}
							}
						});
						return;
					}

					this.savePage(page, currentChapter);
				},
			},
		];

		if (this.admin()) {
			items.push({ type: 'separator' });
			items.push({
				label: 'Link da Imagem',
				icon: 'file',
				action: () => {
					const imageUrl = this.toAbsoluteImageUrl(page.path);

					navigator.clipboard.writeText(imageUrl).then(() => {
						this.notificationService.success(
							'Link da imagem copiado para a área de transferência!',
						);
					});
				},
			});
		}

		this.contextMenuService.open(event, items);
	}

	private lastTapTime = 0;

	onZoneTouch(event: TouchEvent) {
		const currentTime = new Date().getTime();
		const tapLength = currentTime - this.lastTapTime;

		if (tapLength < 300 && tapLength > 0) {
			this.nextPage();
			if (event.cancelable) {
				event.preventDefault();
			}
		}
		this.lastTapTime = currentTime;
	}

	onPagesDoubleClick(event: MouseEvent) {
		const host = event.currentTarget as HTMLElement | null;
		if (!host) {
			return;
		}

		const rect = host.getBoundingClientRect();
		const clickY = event.clientY - rect.top;
		const triggerZoneStart = rect.height * 0.3;

		if (clickY >= triggerZoneStart) {
			this.nextPage();
		}
	}

	private toAbsoluteImageUrl(path: string): string {
		if (!path) {
			return '';
		}

		try {
			return new URL(path).toString();
		} catch {
			const normalizedPath = path.startsWith('/') ? path : `/${path}`;
			return `${window.location.origin}${normalizedPath}`;
		}
	}

	private savePage(page: Page, chapter: Chapter) {
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: PromptModalComponent,
			componentData: {
				title: 'Salvar Página',
				message: 'Deseja adicionar uma nota a esta página?',
				placeholder: 'Ex: Cena importante...',
				close: (comment: string | null) => {
					this.modalNotificationService.close();

					if (comment !== null) {
						if (!page.id) {
							this.notificationService.error(
								'ID da página não encontrado.',
							);
							return;
						}

						this.savedPagesService
							.savePage({
								pageId: page.id,
								chapterId: chapter.id,
								bookId: chapter.bookId,
								comment: comment,
							})
							.subscribe({
								next: () => {
									this.notificationService.success(
										'Página salva com sucesso!',
									);
								},
								error: (err) => {
									console.error('Error saving page', err);
									if (err.status === 400) {
										this.notificationService.info(
											'Esta página já está salva.',
										);
									} else {
										this.notificationService.error(
											'Erro ao salvar página.',
										);
									}
								},
							});
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}
}
