import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
	providedIn: 'root',
})
export class HighlightService {
	private platformId = inject(PLATFORM_ID);
	
	isSupported = signal<boolean>(false);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			this.isSupported.set(typeof (CSS as any)?.highlights !== 'undefined');
		}
	}

	createHighlight(name: string, ranges: Range[]) {
		if (!this.isSupported()) return;

		try {
			const highlight = new (window as any).Highlight(...ranges);
			(CSS as any).highlights.set(name, highlight);
		} catch (err) {
			console.error(`Highlight API Error: ${err}`);
		}
	}

	clearHighlight(name: string) {
		if (!this.isSupported()) return;
		(CSS as any).highlights.delete(name);
	}

	clearAllHighlights() {
		if (!this.isSupported()) return;
		(CSS as any).highlights.clear();
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
