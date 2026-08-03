import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	HostListener,
	signal,
	input,
	output,
} from '@angular/core';
import { ImageMetadata } from '@models/book.models';
import { IconButtonComponent } from '@ui/atoms/icon-button/icon-button.component';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';

@Component({
	selector: 'app-image-viewer',
	standalone: true,
	imports: [CommonModule, IconButtonComponent, BlurhashComponent],
	templateUrl: './image-viewer.component.html',
	styleUrl: './image-viewer.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageViewerComponent {
	imageUrl = input('');
	imageTitle = input('');
	imageDescription = input('');
	blurHash = input<string>();
	metadata = input<ImageMetadata>();
	close = output<void>();

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
