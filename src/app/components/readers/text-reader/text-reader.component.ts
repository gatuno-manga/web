import {
	Component,
	Input,
	Output,
	EventEmitter,
	ElementRef,
	OnInit,
	OnDestroy,
	inject,
	PLATFORM_ID,
	DestroyRef,
	ChangeDetectionStrategy,
	signal,
	viewChild,
	computed,
	OnChanges,
	SimpleChanges,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { ContentFormat } from '../../../models/book.models';
import { MarkdownComponent } from 'ngx-markdown';
import { SettingsService } from '../../../service/settings.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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
	@Input() content = '';
	@Input() format: ContentFormat = 'markdown';
	@Input() initialScrollPercentage = 0;
	@Output() progressChange = new EventEmitter<TextProgressEvent>();

	contentRef = viewChild<ElementRef>('contentRef');

	private platformId = inject(PLATFORM_ID);
	private destroyRef = inject(DestroyRef);
	private settingsService = inject(SettingsService);
	private sanitizer = inject(DomSanitizer);

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
		// biome-ignore lint/complexity/useLiteralKeys: SimpleChanges has index signature and TS config requires bracket access (noPropertyAccessFromIndexSignature: true)
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

			// Restore initial position after render
			if (this.initialScrollPercentage > 0) {
				setTimeout(
					() => this.scrollToPercentage(this.initialScrollPercentage),
					100,
				);
			}
		}
	}

	private updateSafeContent() {
		if (this.format === 'html' && this.content) {
			this.safeContent.set(
				this.sanitizer.bypassSecurityTrustHtml(this.content),
			);
		} else {
			this.safeContent.set('');
		}
	}

	ngOnDestroy() {
		// Cleanup handled by takeUntilDestroyed
	}

	private calculateWordCount() {
		// Strip HTML/markdown and count words
		const plainText = this.content
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
