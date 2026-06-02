import { isPlatformBrowser } from '@angular/common';
import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class HighlightService {
	private platformId = inject(PLATFORM_ID);

	isSupported = signal<boolean>(false);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			this.isSupported.set(
				typeof (CSS as unknown as { highlights: unknown })
					?.highlights !== 'undefined',
			);
		}
	}

	createHighlight(name: string, ranges: Range[]) {
		if (!this.isSupported()) return;

		try {
			const highlight = new (
				window as unknown as {
					Highlight: new (...args: unknown[]) => unknown;
				}
			).Highlight(...ranges);
			(
				CSS as unknown as {
					highlights: { set: (k: string, v: unknown) => void };
				}
			).highlights.set(name, highlight);
		} catch (err) {
			console.error(`Highlight API Error: ${err}`);
		}
	}

	clearHighlight(name: string) {
		if (!this.isSupported()) return;
		(
			CSS as unknown as { highlights: { delete: (k: string) => void } }
		).highlights.delete(name);
	}

	clearAllHighlights() {
		if (!this.isSupported()) return;
		(
			CSS as unknown as { highlights: { clear: () => void } }
		).highlights.clear();
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
