import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CookieService } from './cookie.service';

@Injectable({
	providedIn: 'root',
})
export class CsrfService {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly cookieService = inject(CookieService);
	private readonly CSRF_KEY = 'gatuno-csrf-token';

	private _csrfToken = signal<string | null>(null);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			const stored = localStorage.getItem(this.CSRF_KEY);
			const cookie = this.cookieService.get('csrfToken', false);
			this._csrfToken.set(stored || cookie || null);
		}
	}

	get csrfToken(): string | null {
		return this._csrfToken() || (isPlatformBrowser(this.platformId) ? this.cookieService.get('csrfToken', false) : null);
	}

	setToken(token: string) {
		this._csrfToken.set(token);
		if (isPlatformBrowser(this.platformId)) {
			localStorage.setItem(this.CSRF_KEY, token);
		}
	}

	clear() {
		this._csrfToken.set(null);
		if (isPlatformBrowser(this.platformId)) {
			localStorage.removeItem(this.CSRF_KEY);
			
			this.cookieService.delete('csrfToken', false);
			
			const hostname = window.location.hostname;
			const parts = hostname.split('.');
			
			const domainsToTry = [hostname, `.${hostname}`];
			if (parts.length > 2) {
				domainsToTry.push(`.${parts.slice(-2).join('.')}`);
				domainsToTry.push(`.${parts.slice(-3).join('.')}`);
			}

			for (const domain of domainsToTry) {
				document.cookie = `csrfToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain}`;
			}
			document.cookie = `csrfToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
		}
	}
}
