import {
    Component,
    Input,
    ChangeDetectionStrategy,
    OnChanges,
    SimpleChanges,
    ViewChild,
    ElementRef,
    AfterViewInit,
    OnDestroy
} from '@angular/core';
import { PdfViewerModule, PDFDocumentProxy } from 'ng2-pdf-viewer';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-pdf-page',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PdfViewerModule, CommonModule],
    template: `
        @if (isProxy(src)) {
            <canvas #pdfCanvas></canvas>
        } @else {
            <pdf-viewer
                [src]="$any(src)"
                [page]="page"
                [render-text]="false"
                [original-size]="false"
                [fit-to-page]="true"
                [show-all]="false"
                (after-load-complete)="handleLoadComplete($event)"
                (error)="handleError($event)"
            ></pdf-viewer>
        }
    `,
    styles: [`
        :host {
            display: block;
            width: 100%;
        }

        pdf-viewer, canvas {
            width: 100%;
            display: block;
        }

        ::ng-deep {
            .ng2-pdf-viewer-container {
                overflow: visible !important;
            }

            .pdfViewer .page {
                margin: 0 auto;
                box-shadow: none;
                border: none;
            }
        }
    `]
})
export class PdfPageComponent implements OnChanges, AfterViewInit, OnDestroy {
    @Input() src: string | PDFDocumentProxy = '';
    @Input() page: number = 1;
    @Input() onLoadComplete?: (pdf: PDFDocumentProxy) => void;
    @Input() onError?: (error: any) => void;

    @ViewChild('pdfCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;
    private renderTask: any;

    isProxy(src: any): boolean {
        return src && typeof src !== 'string' && 'numPages' in src;
    }

    ngOnChanges(changes: SimpleChanges) {
        if (this.isProxy(this.src) && (changes['src'] || changes['page'])) {
            this.renderCanvasPage();
        }
    }

    ngAfterViewInit() {
        if (this.isProxy(this.src)) {
            this.renderCanvasPage();
        }
    }

    ngOnDestroy() {
        if (this.renderTask) {
            this.renderTask.cancel();
        }
    }

    async renderCanvasPage() {
        if (!this.isProxy(this.src) || !this.canvasRef) return;

        // Cancel previous render
        if (this.renderTask) {
            this.renderTask.cancel();
        }

        const pdf = this.src as PDFDocumentProxy;
        const pageNumber = this.page;

        try {
            const page = await pdf.getPage(pageNumber);
            const canvas = this.canvasRef.nativeElement;
            const context = canvas.getContext('2d');

            if (!context) return;

            // Use the container width to calculate scale
            // We want high quality, so we render at higher scale if possible
            // But for performance, let's start with a reasonable scale calculation
            const containerWidth = canvas.parentElement?.clientWidth || window.innerWidth;
            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = containerWidth / unscaledViewport.width;

            // Limit max scale to avoid huge canvases
            const finalScale = Math.min(scale * 1.5, 3.0);

            const viewport = page.getViewport({ scale: finalScale });

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Adjust CSS width to match container
            canvas.style.width = '100%';
            canvas.style.height = 'auto';

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            this.renderTask = page.render(renderContext);
            await this.renderTask.promise;

            if (this.onLoadComplete) {
                // Call load complete for consistency, though we passed the proxy in
                this.onLoadComplete(pdf);
            }

        } catch (error: any) {
            if (error?.name !== 'RenderingCancelledException') {
                console.error('Page render error:', error);
                this.handleError(error);
            }
        }
    }

    handleLoadComplete(pdf: PDFDocumentProxy) {
        if (this.onLoadComplete) {
            this.onLoadComplete(pdf);
        }
    }

    handleError(error: any) {
        if (this.onError) {
            this.onError(error);
        }
    }
}
