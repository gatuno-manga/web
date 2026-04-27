import { Component, Input, Output, EventEmitter, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconsComponent } from '../icons/icons.component';
import { BlurhashComponent } from '../blurhash/blurhash.component';
import { ImageMetadata } from '../../models/book.models';

@Component({
    selector: 'app-image-viewer',
    standalone: true,
    imports: [CommonModule, IconsComponent, BlurhashComponent],
    templateUrl: './image-viewer.component.html',
    styleUrl: './image-viewer.component.scss'
})
export class ImageViewerComponent {
    @Input() imageUrl: string = '';
    @Input() imageTitle: string = '';
    @Input() imageDescription: string = '';
    @Input() blurHash?: string;
    @Input() metadata?: ImageMetadata;
    @Output() close = new EventEmitter<void>();

    @HostListener('document:keydown.escape')
    onEscapeKey() {
        this.closeViewer();
    }

    isImageLoaded = signal(false);

    onImageLoad() {
        this.isImageLoaded.set(true);
    }

    closeViewer() {
        this.close.emit();
    }

    onBackdropClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('image-viewer-backdrop')) {
            this.closeViewer();
        }
    }
}
