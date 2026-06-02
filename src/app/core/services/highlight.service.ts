import { isPlatformBrowser } from '@angular/common';
import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';

interface HighlightRegistry {
	set(name: string, highlight: object): void;
	delete(name: string): void;
	clear(): void;
}

interface Highlight {
	new (...ranges: Range[]): object;
}

interface CustomCSS {
	highlights: HighlightRegistry;
}

interface CustomWindow extends Window {
	Highlight: Highlight;
}

@Injectable({
	providedIn: 'root',
})
export class HighlightService {
	private platformId = inject(PLATFORM_ID);

	isSupported = signal<boolean>(false);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			const css = (globalThis as { CSS?: CustomCSS }).CSS;
			this.isSupported.set(typeof css?.highlights !== 'undefined');
		}
	}

	createHighlight(name: string, ranges: Range[]) {
		if (!this.isSupported()) return;

		try {
			const customWindow = window as unknown as CustomWindow;
			const highlight = new customWindow.Highlight(...ranges);
			const css = (globalThis as { CSS: CustomCSS }).CSS;
			css.highlights.set(name, highlight);
		} catch (err) {
			console.error(`Highlight API Error: ${err}`);
		}
	}

	clearHighlight(name: string) {
		if (!this.isSupported()) return;
		const css = (globalThis as { CSS: CustomCSS }).CSS;
		css.highlights.delete(name);
	}

	clearAllHighlights() {
		if (!this.isSupported()) return;
		const css = (globalThis as { CSS: CustomCSS }).CSS;
		css.highlights.clear();
	}

	getSelectionRanges(): Range[] {
		if (!isPlatformBrowser(this.platformId)) return [];

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return [];

		const ranges: Range[] = [];
		for (let i = 0; i < selection.rangeCount; i++) {
			ranges.push(selection.getRangeAt(i));
		}
		return ranges;
	}
}
