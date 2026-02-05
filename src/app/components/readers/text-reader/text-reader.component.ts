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
    HostListener,
    signal,
    viewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { ContentFormat } from '../../../models/book.models';
import { MarkdownComponent } from 'ngx-markdown';

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
    styleUrl: './text-reader.component.scss'
})
export class TextReaderComponent implements OnInit, OnDestroy {
    @Input() content: string = '';
    @Input() format: ContentFormat = 'markdown';
    @Input() initialScrollPercentage: number = 0;
    @Output() progressChange = new EventEmitter<TextProgressEvent>();

    contentRef = viewChild<ElementRef>('contentRef');

    private platformId = inject(PLATFORM_ID);
    private destroyRef = inject(DestroyRef);

    private wordCount = signal(0);
    private virtualPages = signal(1);
    private lastReportedPage = 0;

    ngOnInit() {
        this.calculateWordCount();

        if (isPlatformBrowser(this.platformId)) {
            this.setupScrollListener();

            // Restore initial position after render
            if (this.initialScrollPercentage > 0) {
                setTimeout(() => this.scrollToPercentage(this.initialScrollPercentage), 100);
            }
        }
    }

    ngOnDestroy() {
        // Cleanup handled by takeUntilDestroyed
    }

    private calculateWordCount() {
        // Strip HTML/markdown and count words
        const plainText = this.content
            .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
            .replace(/[#*_~`]/g, '')   // Remove markdown symbols
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();

        const words = plainText.split(' ').filter(w => w.length > 0).length;
        this.wordCount.set(words);
        this.virtualPages.set(Math.max(1, Math.ceil(words / WORDS_PER_PAGE)));
    }

    private setupScrollListener() {
        fromEvent(window, 'scroll')
            .pipe(
                throttleTime(100, undefined, { leading: true, trailing: true }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => this.onScroll());
    }

    private onScroll() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

        if (scrollHeight <= 0) return;

        const scrollPercentage = Math.max(0, (scrollTop / scrollHeight) * 100);
        const currentPage = Math.floor((scrollPercentage / 100) * this.virtualPages()) + 1;
        const clampedPage = Math.min(Math.max(1, currentPage), this.virtualPages());

        // Only emit when page changes
        if (clampedPage > this.lastReportedPage) {
            this.lastReportedPage = clampedPage;
            this.progressChange.emit({
                pageIndex: clampedPage - 1, // 0-indexed for backend compatibility
                totalPages: this.virtualPages(),
                scrollPercentage
            });
        }
    }

    scrollToPercentage(percentage: number) {
        if (!isPlatformBrowser(this.platformId)) return;

        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const targetScroll = (percentage / 100) * scrollHeight;
        window.scrollTo({ top: targetScroll, behavior: 'auto' });
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
