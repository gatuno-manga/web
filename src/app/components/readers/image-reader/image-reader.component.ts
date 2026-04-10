import {
	Component,
	Input,
	Output,
	EventEmitter,
	ElementRef,
	ViewChildren,
	QueryList,
	OnInit,
	OnDestroy,
	AfterViewInit,
	inject,
	PLATFORM_ID,
	DestroyRef,
	ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { Page } from '../../../models/book.models';
import { SettingsService } from '../../../service/settings.service';
import { toSignal } from '@angular/core/rxjs-interop';

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
	imports: [],
	templateUrl: './image-reader.component.html',
	styleUrl: './image-reader.component.scss',
})
export class ImageReaderComponent implements OnInit, AfterViewInit, OnDestroy {
	@Input() pages: Page[] = [];
	@Input() showPageNumbers = false;
	@Output() progressChange = new EventEmitter<ReadingProgressEvent>();
	@Output() contextMenu = new EventEmitter<ContextMenuEvent>();

	@ViewChildren('pageRef') pageRefs!: QueryList<ElementRef>;

	private elRef = inject(ElementRef);
	private platformId = inject(PLATFORM_ID);
	private destroyRef = inject(DestroyRef);
	private settingsService = inject(SettingsService);

	private intersectionObserver: IntersectionObserver | null = null;
	private maxReadPageIndex = 0;
	private currentPageIndex = 0;

	settings = toSignal(this.settingsService.settings$, {
		initialValue: this.settingsService.getSettings(),
	});

	ngOnInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.setupScrollListener();
		}
	}

	private setupScrollListener() {
		fromEvent(window, 'scroll', { capture: true })
			.pipe(
				throttleTime(20, undefined, { leading: true, trailing: true }),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe(() => {
				const container = this.elRef.nativeElement;
				const rect = container.getBoundingClientRect();
				const windowHeight = window.innerHeight;

				// rect.top is the distance from the top of the viewport to the top of the container
				// scrollOffset is how much of the container has passed the top of the viewport
				const scrollOffset = -rect.top;
				const totalHeight = rect.height;

				// We subtract windowHeight because the progress is 100% when the bottom of the container
				// reaches the bottom of the viewport
				const maxScroll = totalHeight - windowHeight;

				if (maxScroll > 0) {
					const scrollPercentage = Math.max(
						0,
						Math.min(100, (scrollOffset / maxScroll) * 100),
					);
					this.progressChange.emit({
						pageIndex: this.currentPageIndex,
						totalPages: this.pages.length,
						scrollPercentage,
					});
				} else if (totalHeight > 0) {
					// Content fits in window or is smaller
					this.progressChange.emit({
						pageIndex: this.currentPageIndex,
						totalPages: this.pages.length,
						scrollPercentage: 100,
					});
				}
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
							totalPages: this.pages.length,
						});
					}
				}
			}
		}, options);

		for (const el of this.pageRefs) {
			this.intersectionObserver?.observe(el.nativeElement);
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
}
