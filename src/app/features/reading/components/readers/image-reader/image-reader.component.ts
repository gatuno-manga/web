import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	DestroyRef,
	ElementRef,
	effect,
	inject,
	input,
	NgZone,
	OnDestroy,
	OnInit,
	output,
	PLATFORM_ID,
	QueryList,
	ViewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SettingsService } from '@core/services/settings.service';
import { ImageMetadata, Page } from '@models/book.models';
import { ImageFallbackDirective } from '@ui/directives/image-fallback.directive';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

export interface ReadingProgressEvent {
	pageIndex: number;
	totalPages: number;
	scrollPercentage?: number;
}

export interface ContextMenuEvent {
	event: MouseEvent;
	page: Page;
	index: number;
}

@Component({
	selector: 'app-image-reader',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './image-reader.component.html',
	styleUrl: './image-reader.component.scss',
	imports: [CommonModule, BlurhashComponent, ImageFallbackDirective],
})
export class ImageReaderComponent implements OnInit, AfterViewInit, OnDestroy {
	pages = input<(Page & { blurHash?: string })[]>([]);
	showPageNumbers = input(false);
	bookBlurHash = input<string>();
	bookDominantColor = input<string>();
	bookMetadata = input<ImageMetadata>();
	isBlurred = input(false);
	progressChange = output<ReadingProgressEvent>();
	contextMenu = output<ContextMenuEvent>();

	constructor() {
		effect(() => {
			this.pages();
			this.loadedPages.clear();
			this.shouldLoadPages.clear();
			this.cdr.markForCheck();
		});
	}

	@ViewChildren('pageRef') pageRefs!: QueryList<ElementRef>;
	private platformId = inject(PLATFORM_ID);
	private destroyRef = inject(DestroyRef);
	private settingsService = inject(SettingsService);
	private cdr = inject(ChangeDetectorRef);
	private ngZone = inject(NgZone);

	private intersectionObserver: IntersectionObserver | null = null;
	private lazyLoadObserver: IntersectionObserver | null = null;
	private maxReadPageIndex = 0;
	private currentPageIndex = 0;

	settings = toSignal(this.settingsService.settings$, {
		initialValue: this.settingsService.getSettings(),
	});

	loadedPages = new Set<number>();
	shouldLoadPages = new Set<number>();

	onImageLoad(index: number) {
		this.loadedPages.add(index);
		this.cdr.markForCheck();
	}

	ngOnInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.setupScrollListener();
		}
	}

	private setupScrollListener() {
		this.ngZone.runOutsideAngular(() => {
			fromEvent(window, 'scroll', { capture: true })
				.pipe(
					throttleTime(100, undefined, {
						leading: true,
						trailing: true,
					}),
					takeUntilDestroyed(this.destroyRef),
				)
				.subscribe(() => {
					const scrollTop =
						window.scrollY || document.documentElement.scrollTop;
					const windowHeight = window.innerHeight;
					const documentHeight =
						document.documentElement.scrollHeight;
					const maxScroll = documentHeight - windowHeight;

					if (maxScroll > 0) {
						const scrollPercentage = Math.max(
							0,
							Math.min(100, (scrollTop / maxScroll) * 100),
						);
						this.progressChange.emit({
							pageIndex: this.currentPageIndex,
							totalPages: this.pages().length,
							scrollPercentage,
						});
					} else {
						this.progressChange.emit({
							pageIndex: this.currentPageIndex,
							totalPages: this.pages().length,
							scrollPercentage: 100,
						});
					}
				});
		});
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

		// Initial setup if pages already exist
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
		if (this.lazyLoadObserver) {
			this.lazyLoadObserver.disconnect();
		}

		if (!isPlatformBrowser(this.platformId)) return;

		const options = {
			root: null,
			rootMargin: '0px',
			threshold: 0.1,
		};

		this.intersectionObserver = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					const index = Number.parseInt(
						entry.target.getAttribute('data-index') || '0',
						10,
					);

					this.currentPageIndex = index;

					// Emite apenas para atualizar a persistência se necessário
					if (index > this.maxReadPageIndex) {
						this.maxReadPageIndex = index;
						this.progressChange.emit({
							pageIndex: index,
							totalPages: this.pages().length,
						});
					}
				}
			}
		}, options);

		this.lazyLoadObserver = new IntersectionObserver(
			(entries) => {
				let hasChanges = false;
				for (const entry of entries) {
					const index = Number.parseInt(
						entry.target.getAttribute('data-index') || '0',
						10,
					);
					if (entry.isIntersecting) {
						if (!this.shouldLoadPages.has(index)) {
							this.shouldLoadPages.add(index);
							hasChanges = true;
						}
					} else {
						// Se saiu da margem de segurança (2 telas pra cima ou pra baixo), descarregamos a imagem
						if (this.shouldLoadPages.has(index)) {
							this.shouldLoadPages.delete(index);
							hasChanges = true;
						}
					}
				}
				if (hasChanges) {
					this.cdr.markForCheck();
				}
			},
			{ rootMargin: '200% 0px' },
		);

		for (const el of this.pageRefs) {
			this.intersectionObserver?.observe(el.nativeElement);
			this.lazyLoadObserver?.observe(el.nativeElement);
		}
	}

	onContextMenu(event: MouseEvent, page: Page, index: number) {
		event.preventDefault();
		this.contextMenu.emit({ event, page, index });
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

	getPageAspectRatio(page: Page, index: number): string {
		if (page.metadata?.width && page.metadata?.height) {
			return `${page.metadata.width} / ${page.metadata.height}`;
		}
		if (this.loadedPages.has(index)) {
			return 'auto';
		}
		if (this.bookMetadata()?.width && this.bookMetadata()?.height) {
			return `${this.bookMetadata()?.width} / ${this.bookMetadata()?.height}`;
		}
		return '2 / 3';
	}

	getPageMinHeight(page: Page, index: number): string {
		if (page.metadata?.width && page.metadata?.height) {
			return 'auto';
		}
		if (this.loadedPages.has(index)) {
			return 'auto';
		}
		if (this.bookMetadata()?.height) {
			return 'auto';
		}
		return '600px';
	}
}
