import { Injectable, inject, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class BodyScrollService {
	private renderer: Renderer2;
	private rendererFactory = inject(RendererFactory2);

	constructor() {
		this.renderer = this.rendererFactory.createRenderer(null, null);
	}

	disableScroll(): void {
		if (typeof document !== 'undefined') {
			this.renderer.setStyle(document.body, 'overflow', 'hidden');
		}
	}

	enableScroll(): void {
		if (typeof document !== 'undefined') {
			this.renderer.removeStyle(document.body, 'overflow');
		}
	}
}
