import {
	Component,
	Input,
	Output,
	EventEmitter,
	OnInit,
	AfterViewInit,
	OnDestroy,
	ElementRef,
	ViewChildren,
	QueryList,
	inject,
	PLATFORM_ID,
	signal,
	DestroyRef,
	ChangeDetectionStrategy,
	Type,
	HostListener,
	OnChanges,
	SimpleChanges,
} from '@angular/core';
import { isPlatformBrowser, NgComponentOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { PDFDocumentProxy } from 'ng2-pdf-viewer';
import { DocumentFormat } from '../../../models/book.models';
import { IconsComponent } from '../../icons/icons.component';
import { ContextMenuService } from '../../../service/context-menu.service';
import { SettingsService } from '../../../service/settings.service';
import { toSignal } from '@angular/core/rxjs-interop';

export interface DocumentProgressEvent {
	pageIndex: number;
	totalPages: number;
	scrollPercentage?: number;
}

// Number of pages to load before and after the visible area
const PAGE_BUFFER = 3;
// Estimated page height for virtual scrolling
const ESTIMATED_PAGE_HEIGHT = 1200;

@Component({
	selector: 'app-document-reader',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IconsComponent, NgComponentOutlet],
	templateUrl: './document-reader.component.html',
	styleUrl: './document-reader.component.scss',
})
export class DocumentReaderComponent
	implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
	@Input() src = '';
	@Input() format: DocumentFormat = 'pdf';
	@Input() initialPage = 1;
	@Input() showPageNumbers = false;
	@Output() pageChange = new EventEmitter<DocumentProgressEvent>();

	@ViewChildren('pageRef') pageRefs!: QueryList<ElementRef>;

	private elRef = inject(ElementRef);
	private platformId = inject(PLATFORM_ID);
	private destroyRef = inject(DestroyRef);
	private contextMenuService = inject(ContextMenuService);
	private settingsService = inject(SettingsService);

	private intersectionObserver: IntersectionObserver | null = null;
	private maxReadPageIndex = 0;
	private scrollTimeout: ReturnType<typeof setTimeout> | null = null;
	private lastScrollPercentage = 0;

	// Store the loaded document proxy to share among pages
	pdfDocument = signal<PDFDocumentProxy | null>(null);

	// Cache inputs to prevent unnecessary re-renders in OnPush
	private inputsCache = new Map<number, Record<string, unknown>>();

	probeInputs: Record<string, unknown> | undefined = undefined;

	currentPage = signal(1);
	totalPages = signal(1);
	pagesArray = signal<number[]>([]);
	visiblePages = signal<Set<number>>(new Set());
	isLoading = signal(true);
	loadError = signal<string | null>(null);
	pdfPageComponent = signal<Type<unknown> | null>(null);

	readonly estimatedPageHeight = ESTIMATED_PAGE_HEIGHT;

	isBrowser = false;

	settings = toSignal(this.settingsService.settings$, {
		initialValue: this.settingsService.getSettings(),
	});

	get isPdfFormat(): boolean {
		return this.format === 'pdf';
	}

	onScroll() {
		// Calculate gradual progress immediately for smoothness
		this.calculateGradualProgress();

		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
		}
		this.scrollTimeout = setTimeout(() => this.updateVisiblePages(), 100);
	}

	private calculateGradualProgress() {
		if (!this.isBrowser) return;

		const container = this.elRef.nativeElement;
		const rect = container.getBoundingClientRect();
		const windowHeight = window.innerHeight;

		const scrollOffset = -rect.top;
		const totalHeight = rect.height;
		const maxScroll = totalHeight - windowHeight;

		if (maxScroll > 0) {
			const scrollPercentage = Math.max(
				0,
				Math.min(100, (scrollOffset / maxScroll) * 100),
			);

			// Emit progress and allow it to decrease
			if (Math.abs(scrollPercentage - this.lastScrollPercentage) > 0.1) {
				this.lastScrollPercentage = scrollPercentage;
				this.pageChange.emit({
					pageIndex: this.currentPage() - 1,
					totalPages: this.totalPages(),
					scrollPercentage,
				});
			}
		}
	}

	ngOnChanges(changes: SimpleChanges) {
		const { src: srcChange } = changes;
		if (srcChange) {
			this.inputsCache.clear();
			this.pdfDocument.set(null);
			this.pagesArray.set([]);
			this.visiblePages.set(new Set());
			this.isLoading.set(true);
			this.loadError.set(null);

			this.probeInputs = {
				src: this.src,
				page: 1,
				onLoadComplete: (pdf: PDFDocumentProxy) =>
					this.onPdfLoaded(pdf),
				onError: (error: unknown) => this.onPdfError(error),
			};

			// Re-emit progress for new document
			if (!srcChange.firstChange) {
				this.currentPage.set(1);
				this.emitProgress();
			}
		}
	}

	ngOnInit() {
		this.isBrowser = isPlatformBrowser(this.platformId);

		if (this.isBrowser) {
			fromEvent(window, 'scroll', { capture: true })
				.pipe(
					throttleTime(20, undefined, {
						leading: true,
						trailing: true,
					}),
					takeUntilDestroyed(this.destroyRef),
				)
				.subscribe(() => this.onScroll());
		}

		if (this.initialPage > 1) {
			this.currentPage.set(this.initialPage);
		}

		if (!this.probeInputs) {
			this.probeInputs = {
				src: this.src,
				page: 1,
				onLoadComplete: (pdf: PDFDocumentProxy) =>
					this.onPdfLoaded(pdf),
				onError: (error: unknown) => this.onPdfError(error),
			};
		}

		this.emitProgress();

		// Load PDF component dynamically only in browser
		if (this.isBrowser && this.isPdfFormat) {
			this.loadPdfComponent();
		}
	}

	private async loadPdfComponent() {
		try {
			const { PdfPageComponent } = await import(
				'./pdf-page/pdf-page.component'
			);
			this.pdfPageComponent.set(PdfPageComponent);
		} catch (error) {
			console.error('Failed to load PDF component:', error);
			this.loadError.set('Erro ao carregar o visualizador de PDF');
			this.isLoading.set(false);
		}
	}

	isPageVisible(pageNum: number): boolean {
		return this.visiblePages().has(pageNum);
	}

	private updateVisiblePages() {
		if (!this.isBrowser || this.pagesArray().length === 0) return;

		const container = this.pageRefs?.first?.nativeElement.parentElement;
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const scrollOffset = -rect.top;
		const windowHeight = window.innerHeight;

		// Calculate which pages should be visible based on scroll position relative to container
		const startPage = Math.max(
			1,
			Math.floor(scrollOffset / this.estimatedPageHeight) - PAGE_BUFFER,
		);
		const endPage = Math.min(
			this.totalPages(),
			Math.ceil(
				(scrollOffset + windowHeight) / this.estimatedPageHeight,
			) + PAGE_BUFFER,
		);

		const newVisiblePages = new Set<number>();
		for (let i = startPage; i <= endPage; i++) {
			newVisiblePages.add(i);
		}

		// Only update if changed
		const currentVisible = this.visiblePages();
		if (
			newVisiblePages.size !== currentVisible.size ||
			![...newVisiblePages].every((p) => currentVisible.has(p))
		) {
			this.visiblePages.set(newVisiblePages);
		}
	}

	createPdfPageInputs(pageNum: number) {
		if (this.inputsCache.has(pageNum)) {
			return this.inputsCache.get(pageNum);
		}

		const inputs = {
			src: this.pdfDocument() || this.src,
			page: pageNum,
		};

		this.inputsCache.set(pageNum, inputs);
		return inputs;
	}

	ngAfterViewInit() {
		if (!isPlatformBrowser(this.platformId)) return;

		this.pageRefs.changes
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((refs: QueryList<ElementRef>) => {
				if (refs.length > 0) {
					setTimeout(() => this.setupIntersectionObserver(), 100);
				}
			});

		if (this.pageRefs.length > 0) {
			setTimeout(() => this.setupIntersectionObserver(), 100);
		}
	}

	ngOnDestroy() {
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
		}
	}

	private setupIntersectionObserver() {
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
		}

		if (!isPlatformBrowser(this.platformId)) return;

		const options = {
			root: null,
			rootMargin: '0px',
			threshold: 0.1,
		};

		this.intersectionObserver = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) {
					continue;
				}

				const index = Number.parseInt(
					entry.target.getAttribute('data-index') || '0',
					10,
				);

				this.currentPage.set(index + 1);
				this.emitProgress();

				if (index > this.maxReadPageIndex) {
					this.maxReadPageIndex = index;
				}
			}
		}, options);

		for (const el of this.pageRefs.toArray()) {
			this.intersectionObserver?.observe(el.nativeElement);
		}
	}

	onPdfLoaded(pdf: PDFDocumentProxy) {
		this.pdfDocument.set(pdf);
		this.totalPages.set(pdf.numPages);
		this.pagesArray.set(
			Array.from({ length: pdf.numPages }, (_, i) => i + 1),
		);
		this.isLoading.set(false);

		// Initialize visible pages based on initial page
		const startPage = Math.max(1, this.initialPage - PAGE_BUFFER);
		const endPage = Math.min(pdf.numPages, this.initialPage + PAGE_BUFFER);
		const initialVisible = new Set<number>();
		for (let i = startPage; i <= endPage; i++) {
			initialVisible.add(i);
		}
		this.visiblePages.set(initialVisible);

		if (this.initialPage > 1) {
			setTimeout(() => this.scrollToPage(this.initialPage - 1), 100);
		}

		// Start updating visible pages
		setTimeout(() => this.updateVisiblePages(), 200);
	}

	onPdfError(error: unknown) {
		console.error('PDF loading error:', error);
		this.loadError.set('Erro ao carregar o PDF');
		this.isLoading.set(false);
	}

	onContextMenu(event: MouseEvent, pageNumber: number) {
		event.preventDefault();
		this.contextMenuService.open(event, [
			{
				label: 'Baixar PDF',
				icon: 'download',
				action: () => this.downloadPdf(),
			},
		]);
	}

	private downloadPdf() {
		const link = document.createElement('a');
		link.href = this.src;
		link.download = 'document.pdf';
		link.click();
	}

	private emitProgress() {
		this.pageChange.emit({
			pageIndex: this.currentPage() - 1,
			totalPages: this.totalPages(),
		});
	}

	scrollToPage(pageIndex: number) {
		const targetElement = this.pageRefs.get(pageIndex);
		if (targetElement) {
			targetElement.nativeElement.scrollIntoView({
				behavior: 'auto',
				block: 'start',
			});
		}
	}

	getPageRefs(): QueryList<ElementRef> {
		return this.pageRefs;
	}

	resetProgress() {
		this.maxReadPageIndex = 0;
	}

	getCurrentPage(): number {
		return this.currentPage();
	}

	getTotalPages(): number {
		return this.totalPages();
	}
}
