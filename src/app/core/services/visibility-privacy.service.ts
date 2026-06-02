import { isPlatformBrowser } from '@angular/common';
import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
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

	private setupVisibilityListener() {
		document.addEventListener('visibilitychange', () => {
			const settings = this.settingsService.getSettings();
			if (settings.privacyBlurOnHide) {
				if (document.visibilityState === 'hidden') {
					this.isBlurred.set(true);
				} else {
					// We might keep it blurred until the user interacts or manually unblurs
					// but for now let's auto-unblur if it was due to visibility
					this.isBlurred.set(false);
				}
			}
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

		const resetTimer = () => {
			if (this.isInactive()) {
				this.isInactive.set(false);
				this.updateBlurState();
			}

			clearTimeout(this.idleTimer);

			const settings = this.settingsService.getSettings();
			if (settings.privacyBlurOnIdle) {
				const timeout = (settings.idleTimeoutSeconds || 60) * 1000;
				this.idleTimer = setTimeout(() => {
					this.isInactive.set(true);
					this.updateBlurState();
				}, timeout);
			}
		};

		activityEvents.forEach((event) => {
			document.addEventListener(event, resetTimer, { passive: true });
		});

		resetTimer();
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
