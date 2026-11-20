import { isPlatformBrowser } from '@angular/common';
import { Injectable, inject, PLATFORM_ID } from '@angular/core';

export interface ScrollRestorationState {
	scrollY: number;
	/** Used by infinite-scroll mode to know how many pages to restore */
	infiniteScrollPage?: number;
}

@Injectable({
	providedIn: 'root',
})
export class ScrollRestorationService {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly isBrowser = isPlatformBrowser(this.platformId);
	private readonly storagePrefix = '@gatuno/scroll';

	/**
	 * Saves the current window scroll position for a given key.
	 */
	save(key: string, extra?: Partial<ScrollRestorationState>): void {
		if (!this.isBrowser) return;

		const state: ScrollRestorationState = {
			scrollY: window.scrollY,
			...extra,
		};

		try {
			sessionStorage.setItem(
				`${this.storagePrefix}/${key}`,
				JSON.stringify(state),
			);
		} catch {
			// sessionStorage might be unavailable (e.g. private mode quota exceeded)
		}
	}

	/**
	 * Retrieves the saved scroll state for a given key without removing it.
	 */
	get(key: string): ScrollRestorationState | null {
		if (!this.isBrowser) return null;

		try {
			const raw = sessionStorage.getItem(`${this.storagePrefix}/${key}`);
			if (!raw) return null;
			return JSON.parse(raw) as ScrollRestorationState;
		} catch {
			return null;
		}
	}

	/**
	 * Retrieves and removes the saved scroll state for a given key.
	 */
	consume(key: string): ScrollRestorationState | null {
		const state = this.get(key);
		this.clear(key);
		return state;
	}

	/**
	 * Removes the saved scroll state for a given key.
	 */
	clear(key: string): void {
		if (!this.isBrowser) return;

		try {
			sessionStorage.removeItem(`${this.storagePrefix}/${key}`);
		} catch {
			// ignore
		}
	}

	/**
	 * Scrolls window to the given Y position, waiting for Angular to finish
	 * rendering the list before attempting the scroll.
	 *
	 * The initial delay is intentional: even after isLoading=false, Angular's
	 * change detection still needs one tick to render the new DOM nodes.
	 * Without the delay the page is still mostly empty and the scroll target
	 * cannot be reached.
	 */
	restoreAfterRender(scrollY: number, retries = 5): void {
		if (!this.isBrowser || scrollY <= 0) return;

		const attempt = (remaining: number) => {
			requestAnimationFrame(() => {
				const mainEl = document.querySelector('main');
				const isMainScrollable =
					mainEl &&
					window.getComputedStyle(mainEl).overflowY === 'auto';
				const scrollContainer = isMainScrollable ? mainEl : window;

				scrollContainer.scrollTo({ top: scrollY, behavior: 'instant' });

				const currentScrollY = isMainScrollable
					? mainEl.scrollTop
					: window.scrollY;

				// If the browser couldn't reach the target yet (DOM still growing),
				// retry after a short delay.
				if (remaining > 0 && Math.abs(currentScrollY - scrollY) > 80) {
					setTimeout(() => attempt(remaining - 1), 200);
				}
			});
		};

		// Wait for Angular's change detection to render the list items before
		// attempting to scroll. 250 ms is enough for a typical OnDefault component
		// with an HTTP response already in memory.
		setTimeout(() => attempt(retries), 250);
	}
}
