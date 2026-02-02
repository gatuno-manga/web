import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit,
    inject,
    PLATFORM_ID,
    signal,
    ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentFormat } from '../../../models/book.models';
import { IconsComponent } from '../../icons/icons.component';

export interface DocumentProgressEvent {
    pageIndex: number;
    totalPages: number;
}

@Component({
    selector: 'app-document-reader',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IconsComponent],
    templateUrl: './document-reader.component.html',
    styleUrl: './document-reader.component.scss'
})
export class DocumentReaderComponent implements OnInit {
    @Input() src: string = '';
    @Input() format: DocumentFormat = 'pdf';
    @Input() initialPage: number = 1;
    @Output() pageChange = new EventEmitter<DocumentProgressEvent>();

    private platformId = inject(PLATFORM_ID);
    private sanitizer = inject(DomSanitizer);

    currentPage = signal(1);
    totalPages = signal(1);
    safeSrc: SafeResourceUrl = '';

    isBrowser = false;

    get isPdfFormat(): boolean {
        return this.format === 'pdf';
    }

    ngOnInit() {
        this.isBrowser = isPlatformBrowser(this.platformId);

        if (this.initialPage > 1) {
            this.currentPage.set(this.initialPage);
        }

        if (this.src) {
            // Add page parameter if supported by browser's PDF viewer
            const pageParam = this.initialPage > 1 ? `#page=${this.initialPage}` : '';
            this.safeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(this.src + pageParam);
        }

        // Emit initial progress
        this.emitProgress();
    }

    private emitProgress() {
        this.pageChange.emit({
            pageIndex: this.currentPage() - 1,
            totalPages: this.totalPages()
        });
    }

    getCurrentPage(): number {
        return this.currentPage();
    }

    getTotalPages(): number {
        return this.totalPages();
    }
}
