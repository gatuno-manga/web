import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

const LANGUAGE_KEY = 'app-language';

export interface SupportedLanguage {
	code: string;
	name: string;
}

@Injectable({
	providedIn: 'root',
})
export class LanguageService {
	public languages = signal<SupportedLanguage[]>([]);
	public currentLanguage = signal<string>('pt-BR');

	constructor(
		@Inject(PLATFORM_ID) private platformId: object,
		private localStorageService: LocalStorageService,
		private http: HttpClient,
	) {
		if (isPlatformBrowser(this.platformId)) {
			const savedLang =
				this.localStorageService.get<string>(LANGUAGE_KEY);
			const browserLang = navigator.language;

			// Prioritize saved language, then browser language (normalized), then default 'pt-BR'
			const initialLang =
				savedLang || this.normalizeBrowserLang(browserLang) || 'pt-BR';
			this.currentLanguage.set(initialLang);

			this.loadSupportedLanguages();
		}
	}

	private normalizeBrowserLang(lang: string): string | null {
		if (!lang) return null;
		// Simple normalization for common cases if needed,
		// but we should ideally match against supported languages once loaded.
		return lang;
	}

	private loadSupportedLanguages(): void {
		this.http.get<SupportedLanguage[]>('/api/languages').subscribe({
			next: (langs) => {
				this.languages.set(langs);
				// After loading, we could verify if the currentLanguage is in the list,
				// but navigator.language might be more specific (e.g. pt-PT) than supported ones.
			},
			error: (err) => console.error('Error loading languages', err),
		});
	}

	public setLanguage(code: string): void {
		this.currentLanguage.set(code);
		this.localStorageService.set(LANGUAGE_KEY, code);
		// Note: In a real app, this would also trigger a translation reload (e.g. transloco or ngx-translate)
		// and possibly update LOCALE_ID dynamically if configured.
	}
}
