import { CommonModule } from '@angular/common';
import {
	Component,
	EventEmitter,
	HostListener,
	Input,
	Output,
	signal,
} from '@angular/core';
import { ImageMetadata } from '@models/book.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';

@Component({
	selector: 'app-image-viewer',
	standalone: true,
	imports: [CommonModule, IconsComponent, BlurhashComponent],
	templateUrl: './image-viewer.component.html',
	styleUrl: './image-viewer.component.scss',
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
		if (
			(event.target as HTMLElement).classList.contains(
				'image-viewer-backdrop',
			)
		) {
			this.closeViewer();
		}
	}
}
