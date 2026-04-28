import { effect, Inject, Injectable, PLATFORM_ID, Renderer2, RendererFactory2, signal } from "@angular/core";
import { CookieService } from "./cookie.service";
import { isPlatformBrowser } from "@angular/common";
import { LocalStorageService } from "./local-storage.service";

const THEME_KEY = 'theme';

export type AppTheme = 'light' | 'dark' | 'true-dark' | string;

@Injectable({
	providedIn: 'root',
})
export class ThemeService {
	private renderer: Renderer2;
	public currentTheme = signal<AppTheme>('light');
	public hasUserSelectedTheme = signal<boolean>(false);

	constructor(
		@Inject(PLATFORM_ID) private platformId: Object,
		private rendererFactory: RendererFactory2,
		private cookieService: CookieService,
		private localStorageService: LocalStorageService,
	) {
		this.renderer = this.rendererFactory.createRenderer(null, null);
		if (isPlatformBrowser(this.platformId)) {
			const savedTheme = this.localStorageService.get(THEME_KEY) as AppTheme | null;
			const htmlTheme = document?.documentElement?.getAttribute(
				'data-theme',
			) as AppTheme | null;
			const initialTheme = savedTheme || htmlTheme || 'light';

			this.currentTheme.set(initialTheme);
			this.hasUserSelectedTheme.set(!!savedTheme);

			effect(() => {
				const theme = this.currentTheme();
				this.renderer.setAttribute(document.documentElement, 'data-theme', theme);
				this.localStorageService.set(THEME_KEY, theme);
				this.cookieService.set(THEME_KEY, theme, false, { path: '/' });
			});
		}
	}

	public setTheme(theme: AppTheme): void {
		this.currentTheme.set(theme);
		this.hasUserSelectedTheme.set(true);
	}

	public setThemeFromServer(theme: AppTheme): void {
		if (!isPlatformBrowser(this.platformId)) {
			this.currentTheme.set(theme);
		}
	}
}
