import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
	providedIn: 'root',
})
export class FullscreenService {
	private platformId = inject(PLATFORM_ID);
	
	isFullscreen = signal<boolean>(false);
	isSupported = signal<boolean>(false);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			this.isSupported.set(!!document.fullscreenEnabled);
			
			document.addEventListener('fullscreenchange', () => {
				this.isFullscreen.set(!!document.fullscreenElement);
			});
		}
	}

	async toggleFullscreen(element?: HTMLElement) {
		if (!this.isSupported()) return;

		try {
			if (!document.fullscreenElement) {
				const target = element || document.documentElement;
				await target.requestFullscreen();
			} else {
				await document.exitFullscreen();
			}
		} catch (err) {
			console.error(`Fullscreen Error: ${err}`);
		}
	}

	async enterFullscreen(element?: HTMLElement) {
		if (!this.isSupported() || document.fullscreenElement) return;
		
		try {
			const target = element || document.documentElement;
			await target.requestFullscreen();
		} catch (err) {
			console.error(`Fullscreen Enter Error: ${err}`);
		}
	}

	async exitFullscreen() {
		if (!this.isSupported() || !document.fullscreenElement) return;

		try {
			await document.exitFullscreen();
		} catch (err) {
			console.error(`Fullscreen Exit Error: ${err}`);
		}
	}
}
