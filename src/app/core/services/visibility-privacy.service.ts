import { isPlatformBrowser } from '@angular/common';
import { Injectable, inject, PLATFORM_ID, signal, NgZone } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({
	providedIn: 'root',
})
export class VisibilityPrivacyService {
	private platformId = inject(PLATFORM_ID);
	private settingsService = inject(SettingsService);

	private idleTimer: ReturnType<typeof setTimeout> | undefined;

	isBlurred = signal<boolean>(false);
	isInactive = signal<boolean>(false);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			this.setupVisibilityListener();
			this.setupIdleListener();
		}
	}

	private ngZone = inject(NgZone);

	private setupVisibilityListener() {
		this.ngZone.runOutsideAngular(() => {
			document.addEventListener('visibilitychange', () => {
				this.ngZone.run(() => {
					const settings = this.settingsService.getSettings();
					if (settings.privacyBlurOnHide) {
						if (document.visibilityState === 'hidden') {
							this.isBlurred.set(true);
						} else {
							this.isBlurred.set(false);
						}
					}
				});
			});
		});
	}

	private setupIdleListener() {
		const activityEvents = [
			'mousedown',
			'mousemove',
			'keypress',
			'scroll',
			'touchstart',
		];

		let lastActivity = Date.now();

		const resetTimer = () => {
			const now = Date.now();
			// Throttle resetTimer to run at most once per second
			if (now - lastActivity < 1000 && this.idleTimer) {
				return;
			}
			lastActivity = now;

			this.ngZone.run(() => {
				if (this.isInactive()) {
					this.isInactive.set(false);
					this.updateBlurState();
				}
			});

			clearTimeout(this.idleTimer);

			const settings = this.settingsService.getSettings();
			if (settings.privacyBlurOnIdle) {
				const timeout = (settings.idleTimeoutSeconds || 60) * 1000;
				// setTimeout inside runOutsideAngular so it doesn't trigger CD on tick
				this.ngZone.runOutsideAngular(() => {
					this.idleTimer = setTimeout(() => {
						this.ngZone.run(() => {
							this.isInactive.set(true);
							this.updateBlurState();
						});
					}, timeout);
				});
			}
		};

		this.ngZone.runOutsideAngular(() => {
			activityEvents.forEach((event) => {
				document.addEventListener(event, resetTimer, { passive: true });
			});
			resetTimer();
		});
	}

	private updateBlurState() {
		const settings = this.settingsService.getSettings();
		const shouldBlur = !!(
			(settings.privacyBlurOnHide &&
				document.visibilityState === 'hidden') ||
			(settings.privacyBlurOnIdle && this.isInactive())
		);

		this.isBlurred.set(shouldBlur);
	}

	unblurManually() {
		this.isBlurred.set(false);
		// If unblurred manually, we might want to reset the idle timer
		this.isInactive.set(false);
	}
}
