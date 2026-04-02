import {
	Component,
	Input,
	Output,
	EventEmitter,
	ElementRef,
	ViewChildren,
	QueryList,
	OnDestroy,
	AfterViewInit,
	inject,
	PLATFORM_ID,
	DestroyRef,
	ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Page } from '../../../models/book.models';
import { SettingsService } from '../../../service/settings.service';
import { toSignal } from '@angular/core/rxjs-interop';

export interface ReadingProgressEvent {
	pageIndex: number;
	totalPages: number;
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
export class ImageReaderComponent implements AfterViewInit, OnDestroy {
	@Input() pages: Page[] = [];
	@Input() showPageNumbers = false;
	@Output() progressChange = new EventEmitter<ReadingProgressEvent>();
	@Output() contextMenu = new EventEmitter<ContextMenuEvent>();

	@ViewChildren('pageRef') pageRefs!: QueryList<ElementRef>;

	private platformId = inject(PLATFORM_ID);
	private destroyRef = inject(DestroyRef);
	private settingsService = inject(SettingsService);

	private intersectionObserver: IntersectionObserver | null = null;
	private maxReadPageIndex = 0;

	settings = toSignal(this.settingsService.settings$, {
		initialValue: this.settingsService.getSettings(),
	});

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
