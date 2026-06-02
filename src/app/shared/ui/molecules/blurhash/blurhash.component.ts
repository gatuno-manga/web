import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	effect,
	input,
	viewChild,
} from '@angular/core';
import { decode } from 'blurhash';

@Component({
	selector: 'app-blurhash',
	standalone: true,
	templateUrl: './blurhash.component.html',
	styleUrl: './blurhash.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlurhashComponent implements AfterViewInit {
	hash = input<string>();
	width = input<number>(32);
	height = input<number>(32);
	punch = input<number>(1);

	canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	constructor() {
		effect(() => {
			this.hash();
			this.width();
			this.height();
			const canvas = this.canvasRef();
			if (canvas) {
				this.render();
			}
		});
	}

	ngAfterViewInit() {
		this.render();
	}

	private render() {
		const hashValue = this.hash();
		if (!hashValue || hashValue.length < 6) return;

		try {
			const canvasEl = this.canvasRef()?.nativeElement;
			if (!canvasEl) return;

			const widthValue = this.width();
			const heightValue = this.height();

			// Always decode to a small resolution for performance
			const decodeWidth = 32;
			const decodeHeight =
				widthValue && heightValue
					? Math.round(32 * (heightValue / widthValue))
					: 32;

			const pixels = decode(
				hashValue,
				decodeWidth,
				decodeHeight,
				this.punch(),
			);

			canvasEl.width = decodeWidth;
			canvasEl.height = decodeHeight;

			const ctx = canvasEl.getContext('2d');
			if (ctx) {
				const imageData = ctx.createImageData(
					decodeWidth,
					decodeHeight,
				);
				imageData.data.set(pixels);
				ctx.putImageData(imageData, 0, 0);
			}
		} catch (error) {
			console.error('Error rendering blurhash:', error);
		}
	}
}
