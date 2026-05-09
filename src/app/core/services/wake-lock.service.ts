import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
	providedIn: 'root',
})
export class WakeLockService {
	private platformId = inject(PLATFORM_ID);
	private wakeLock: any = null;
	
	isSupported = signal<boolean>(false);
	isActive = signal<boolean>(false);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			this.isSupported.set('wakeLock' in navigator);
			
			// Re-acquire wake lock when page becomes visible again
			document.addEventListener('visibilitychange', async () => {
				if (this.wakeLock !== null && document.visibilityState === 'visible') {
					await this.request();
				}
			});
		}
	}

	async request() {
		if (!this.isSupported()) return;

		try {
			this.wakeLock = await (navigator as any).wakeLock.request('screen');
			this.isActive.set(true);
			
			this.wakeLock.addEventListener('release', () => {
				this.isActive.set(false);
			});
		} catch (err) {
			console.error(`Wake Lock Error: ${err}`);
			this.isActive.set(false);
		}
	}

	async release() {
		if (!this.wakeLock) return;

		try {
			await this.wakeLock.release();
			this.wakeLock = null;
			this.isActive.set(false);
		} catch (err) {
			console.error(`Wake Lock Release Error: ${err}`);
		}
	}
}
