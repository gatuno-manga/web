import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	ElementRef,
	inject,
	OnChanges,
	OnDestroy,
	OnInit,
	PLATFORM_ID,
	SimpleChanges,
	signal,
	viewChild,
	input,
	output,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HighlightService } from '@core/services/highlight.service';
import { SettingsService } from '@core/services/settings.service';
import { ContentFormat } from '@models/book.models';
import { MarkdownComponent } from 'ngx-markdown';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

export interface TextProgressEvent {
	pageIndex: number;
	totalPages: number;
	scrollPercentage: number;
}

// Constants for virtual page calculation
const WORDS_PER_PAGE = 300;

@Component({
	selector: 'app-text-reader',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MarkdownComponent],
	templateUrl: './text-reader.component.html',
	styleUrl: './text-reader.component.scss',
})
export class TextReaderComponent implements OnInit, OnChanges, OnDestroy {
	content = input('');
	format = input<ContentFormat>('markdown');
	initialScrollPercentage = input(0);
	progressChange = output<TextProgressEvent>();

	contentRef = viewChild<ElementRef>('contentRef');

	private platformId = inject(PLATFORM_ID);
	private destroyRef = inject(DestroyRef);
	private settingsService = inject(SettingsService);
	private highlightService = inject(HighlightService);
	private sanitizer = inject(DomSanitizer);
	private intersectionObserver: IntersectionObserver | null = null;

	settings = toSignal(this.settingsService.settings$, {
		initialValue: this.settingsService.getSettings(),
	});

	safeContent = signal<SafeHtml>('');

	private styleSnapshot = computed(() => {
		const currentSettings = this.settings();
		return {
			'font-size':
				currentSettings.fontSize != null
					? `${currentSettings.fontSize}px`
					: null,
			'font-family': currentSettings.fontFamily ?? null,
			'line-height':
				currentSettings.lineHeight != null
					? `${currentSettings.lineHeight}`
					: null,
			'letter-spacing':
				currentSettings.letterSpacing != null
					? `${currentSettings.letterSpacing}px`
					: null,
			'text-align': currentSettings.textAlign ?? null,
		};
	});

	private wordCount = signal(0);
	private virtualPages = signal(1);
	private lastReportedPage = 0;

	// Keep compatibility with stale/cached templates that still call textStyle().
	textStyle(): Record<string, string | null> {
		return this.styleSnapshot();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['content'] || changes['format']) {
			this.updateSafeContent();
			this.calculateWordCount();
		}
	}

	ngOnInit() {
		this.updateSafeContent();
		this.calculateWordCount();

		if (isPlatformBrowser(this.platformId)) {
			this.setupScrollListener();
			this.setupSelectionListener();
			setTimeout(() => this.setupIntersectionObserver(), 500);

			// Restore initial position after render
			if (this.initialScrollPercentage() > 0) {
				setTimeout(
					() => this.scrollToPercentage(this.initialScrollPercentage()),
					100,
				);
			}
		}
	}

	private updateSafeContent() {
		if (this.format() === 'html' && this.content()) {
			this.safeContent.set(
				this.sanitizer.bypassSecurityTrustHtml(this.content()),
			);
		} else {
			this.safeContent.set('');
		}
	}

	ngOnDestroy() {
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
		}
	}

	private calculateWordCount() {
		// Strip HTML/markdown and count words
		const plainText = this.content()
			.replace(/<[^>]*>/g, ' ') // Remove HTML tags
			.replace(/[#*_~`]/g, '') // Remove markdown symbols
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();

		const words = plainText.split(' ').filter((w) => w.length > 0).length;
		this.wordCount.set(words);
		this.virtualPages.set(Math.max(1, Math.ceil(words / WORDS_PER_PAGE)));
	}

	private setupScrollListener() {
		fromEvent(window, 'scroll', { capture: true })
			.pipe(
				throttleTime(20, undefined, { leading: true, trailing: true }),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe(() => this.onScroll());
	}

	private setupSelectionListener() {
		fromEvent(document, 'selectionchange')
			.pipe(
				throttleTime(200, undefined, { leading: true, trailing: true }),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe(() => {
				const ranges = this.highlightService.getSelectionRanges();
				if (ranges.length > 0) {
					this.highlightService.createHighlight(
						'reading-selection',
						ranges,
					);
				}
			});
	}

	private setupIntersectionObserver() {
		if (!isPlatformBrowser(this.platformId)) return;

		const container = this.contentRef()?.nativeElement;
		if (!container) return;

		const elements = container.querySelectorAll(
			'p, h1, h2, h3, h4, h5, h6, li, pre',
		);
		if (elements.length === 0) return;

		const options = {
			root: null,
			rootMargin: '-10% 0px -10% 0px',
			threshold: 0.1,
		};

		this.intersectionObserver = new IntersectionObserver((entries) => {
			let bestEntry: IntersectionObserverEntry | null = null;

			for (const entry of entries) {
				if (entry.isIntersecting) {
					if (
						!bestEntry ||
						entry.intersectionRatio > bestEntry.intersectionRatio
					) {
						bestEntry = entry;
					}
				}
			}

			if (bestEntry) {
				// No logic needed here yet, just identifying best entry
			}
		}, options);

		for (const el of Array.from(elements) as Element[]) {
			this.intersectionObserver?.observe(el);
		}
	}

	private onScroll() {
		const container = this.contentRef()?.nativeElement;
		if (!container || !isPlatformBrowser(this.platformId)) return;

		const rect = container.getBoundingClientRect();
		const containerHeight = rect.height;
		const windowHeight = window.innerHeight;

		const scrollOffset = -rect.top;
		const maxScroll = containerHeight - windowHeight;

		if (maxScroll <= 0) {
			this.emitProgress(100);
			return;
		}

		const scrollPercentage = Math.max(
			0,
			Math.min(100, (scrollOffset / maxScroll) * 100),
		);
		this.emitProgress(scrollPercentage);
	}

	private emitProgress(scrollPercentage: number) {
		const currentPage =
			Math.floor((scrollPercentage / 100) * this.virtualPages()) + 1;
		const clampedPage = Math.min(
			Math.max(1, currentPage),
			this.virtualPages(),
		);

		// Emit when page changes (any direction) or progress significantly changes (for visual smoothness)
		if (
			clampedPage !== this.lastReportedPage ||
			Math.abs(
				scrollPercentage -
					(this.lastReportedPage / this.virtualPages()) * 100,
			) > 1
		) {
			this.lastReportedPage = clampedPage;
			this.progressChange.emit({
				pageIndex: clampedPage - 1, // 0-indexed for backend compatibility
				totalPages: this.virtualPages(),
				scrollPercentage,
			});
		}
	}

	scrollToPercentage(percentage: number) {
		if (!isPlatformBrowser(this.platformId)) return;

		const container = this.contentRef()?.nativeElement;
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const scrollTop =
			window.scrollY || document.documentElement.scrollTop || 0;
		const containerTop = rect.top + scrollTop;
		const containerHeight = rect.height;
		const windowHeight = window.innerHeight;

		const maxScroll = containerHeight - windowHeight;
		const targetScrollInside = (percentage / 100) * maxScroll;

		window.scrollTo({
			top: containerTop + targetScrollInside,
			behavior: 'auto',
		});
	}

	scrollToPage(pageIndex: number) {
		const percentage = (pageIndex / this.virtualPages()) * 100;
		this.scrollToPercentage(percentage);
	}

	getVirtualPages(): number {
		return this.virtualPages();
	}

	resetProgress() {
		this.lastReportedPage = 0;
	}
}
