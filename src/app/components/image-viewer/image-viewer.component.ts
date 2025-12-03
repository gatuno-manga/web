import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconsComponent } from '../icons/icons.component';

@Component({
    selector: 'app-image-viewer',
    standalone: true,
    imports: [CommonModule, IconsComponent],
    templateUrl: './image-viewer.component.html',
    styleUrl: './image-viewer.component.scss'
})
export class ImageViewerComponent {
    @Input() imageUrl: string = '';
    @Input() imageTitle: string = '';
    @Output() close = new EventEmitter<void>();

    @HostListener('document:keydown.escape')
    onEscapeKey() {
        this.closeViewer();
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
