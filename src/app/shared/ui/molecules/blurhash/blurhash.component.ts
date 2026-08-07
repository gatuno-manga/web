import { isPlatformBrowser } from '@angular/common';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	effect,
	inject,
	input,
	PLATFORM_ID,
	viewChild,
} from '@angular/core';
import { decode } from 'blurhash';

class LRUCache<K, V> {
	private max: number;
	private cache: Map<K, V>;

	constructor(max = 500) {
		this.max = max;
		this.cache = new Map();
	}

	get(key: K): V | undefined {
		if (this.cache.has(key)) {
			const val = this.cache.get(key)!;
			// move to end to mark as recently used
			this.cache.delete(key);
			this.cache.set(key, val);
			return val;
		}
		return undefined;
	}

	set(key: K, val: V) {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.max) {
			// evict least recently used (first item)
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) {
				this.cache.delete(firstKey);
			}
		}
		this.cache.set(key, val);
	}
}

// Global cache to prevent re-decoding the same blurhash multiple times (limited to ~3MB)
const blurhashCache = new LRUCache<string, Uint8ClampedArray>(500);

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

	private platformId = inject(PLATFORM_ID);

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
		if (!isPlatformBrowser(this.platformId)) return;

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

			const cacheKey = `${hashValue}-${decodeWidth}-${decodeHeight}-${this.punch()}`;
			let pixels = blurhashCache.get(cacheKey);

			if (!pixels) {
				pixels = decode(
					hashValue,
					decodeWidth,
					decodeHeight,
					this.punch(),
				);
				blurhashCache.set(cacheKey, pixels);
			}

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
