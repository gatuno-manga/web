import { isPlatformBrowser } from '@angular/common';
import {
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

// Global cache to prevent re-decoding the same blurhash multiple times.
// Com o lado maior limitado a 64px em decodeSize(), cada entrada custa no
// máximo 64*64*4 = 16KB, então 500 entradas ficam abaixo de ~8MB no pior caso.
const blurhashCache = new LRUCache<string, Uint8ClampedArray>(500);

@Component({
	selector: 'app-blurhash',
	standalone: true,
	templateUrl: './blurhash.component.html',
	styleUrl: './blurhash.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlurhashComponent {
	hash = input<string>();
	width = input<number>(32);
	height = input<number>(32);
	punch = input<number>(1);

	private platformId = inject(PLATFORM_ID);

	canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	constructor() {
		// O effect já dispara quando o viewChild do canvas resolve, então ele
		// cobre sozinho o caso do primeiro render. Um ngAfterViewInit aqui
		// decodificaria o mesmo hash duas vezes por instância.
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

	/**
	 * decode() custa width * height * componentX * componentY * 2 chamadas a
	 * Math.cos, sem memoização da base. Derivar a altura direto da proporção da
	 * imagem (32 * height/width) é ilimitado: uma tira de webtoon 800x8000 vira
	 * decode(32, 320) = ~245 mil Math.cos numa única chamada síncrona na main
	 * thread. O blurhash é uma aproximação de baixa frequência (no máximo 9x9
	 * coeficientes) e ainda é escalado por CSS, então limitar o lado maior não
	 * tem custo visual — mantemos a proporção para o object-fit não recortar.
	 */
	private decodeSize(): { width: number; height: number } {
		const MAX_SIDE = 64;
		const BASE = 32;

		const w = this.width();
		const h = this.height();
		if (!w || !h || w <= 0 || h <= 0) {
			return { width: BASE, height: BASE };
		}

		const ratio = h / w;
		let decodeWidth = BASE;
		let decodeHeight = Math.round(BASE * ratio);

		// Só a altura pode estourar: a largura é fixa em BASE (< MAX_SIDE).
		if (decodeHeight > MAX_SIDE) {
			decodeHeight = MAX_SIDE;
			decodeWidth = Math.round(MAX_SIDE / ratio);
		}

		return {
			width: Math.max(4, decodeWidth),
			height: Math.max(4, decodeHeight),
		};
	}

	private render() {
		if (!isPlatformBrowser(this.platformId)) return;

		const hashValue = this.hash();
		if (!hashValue || hashValue.length < 6) return;

		try {
			const canvasEl = this.canvasRef()?.nativeElement;
			if (!canvasEl) return;

			// Always decode to a small, bounded resolution for performance
			const { width: decodeWidth, height: decodeHeight } =
				this.decodeSize();

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

			// Atribuir canvas.width/height realoca o backing store mesmo quando
			// o valor não muda, então só escrevemos se for diferente.
			if (canvasEl.width !== decodeWidth) canvasEl.width = decodeWidth;
			if (canvasEl.height !== decodeHeight)
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
