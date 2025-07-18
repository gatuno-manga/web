import { effect, Inject, Injectable, PLATFORM_ID, Renderer2, RendererFactory2, signal } from "@angular/core";
import { CookieService } from "./cookie.service";
import { isPlatformBrowser } from "@angular/common";
import { LocalStorageService } from "./local-storage.service";

const THEME_KEY = 'theme';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private renderer: Renderer2;
    public currentTheme = signal<'light' | 'dark'>('light');

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
        private rendererFactory: RendererFactory2,
        private cookieService: CookieService,
        private localStorageService: LocalStorageService
    ) {
        this.renderer = this.rendererFactory.createRenderer(null, null);
        if (isPlatformBrowser(this.platformId)) {
            const initialTheme = document?.documentElement?.getAttribute('data-theme') as 'light' | 'dark' || 'light';
            this.currentTheme.set(initialTheme);

            effect(() => {
                const theme = this.currentTheme();
                this.renderer.setAttribute(document.documentElement, 'data-theme', theme);
                this.localStorageService.set(THEME_KEY, theme);
                this.cookieService.set(THEME_KEY, theme, true, { path: '/' });
            });
        }
    }

    public toggleTheme(): void {
        this.currentTheme.update(current => (current === 'light' ? 'dark' : 'light'));
    }

    public setThemeFromServer(theme: 'light' | 'dark'): void {
        if (!isPlatformBrowser(this.platformId)) {
            this.currentTheme.set(theme);
        }
    }
}
