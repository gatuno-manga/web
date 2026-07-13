import { isPlatformBrowser } from '@angular/common';
import {
	effect,
	Inject,
	Injectable,
	PLATFORM_ID,
	Renderer2,
	RendererFactory2,
	signal,
} from '@angular/core';
import { CookieService } from './cookie.service';
import { LocalStorageService } from './local-storage.service';

const THEME_KEY = 'theme';
const CUSTOM_COLORS_KEY = 'custom_colors';

export type AppTheme = 'light' | 'dark' | 'true-dark' | string;
export type CustomColors = Record<string, string>;

@Injectable({
	providedIn: 'root',
})
export class ThemeService {
	private renderer: Renderer2;
	public currentTheme = signal<AppTheme>('light');
	public hasUserSelectedTheme = signal<boolean>(true);
	public customColors = signal<CustomColors>({});

	constructor(
		@Inject(PLATFORM_ID) private platformId: object,
		private rendererFactory: RendererFactory2,
		private cookieService: CookieService,
		private localStorageService: LocalStorageService,
	) {
		this.renderer = this.rendererFactory.createRenderer(null, null);
		if (isPlatformBrowser(this.platformId)) {
			const savedTheme = this.localStorageService.get(
				THEME_KEY,
			) as AppTheme | null;
			const htmlTheme = document?.documentElement?.getAttribute(
				'data-theme',
			) as AppTheme | null;
			const initialTheme = savedTheme || htmlTheme || 'light';

			this.currentTheme.set(initialTheme);
			this.hasUserSelectedTheme.set(!!savedTheme);

			const savedCustomColors = this.localStorageService.get(
				CUSTOM_COLORS_KEY,
			) as CustomColors | null;
			if (savedCustomColors) {
				this.customColors.set(savedCustomColors);
			}

			effect(() => {
				const theme = this.currentTheme();
				this.renderer.setAttribute(
					document.documentElement,
					'data-theme',
					theme,
				);
				this.localStorageService.set(THEME_KEY, theme);
				this.cookieService.set(THEME_KEY, theme, false, { path: '/' });
			});

			let previousColors: string[] = [];
			effect(() => {
				const colors = this.customColors();

				for (const key of previousColors) {
					if (!colors[key]) {
						this.renderer.removeStyle(
							document.documentElement,
							key,
						);
					}
				}

				for (const [key, value] of Object.entries(colors)) {
					this.renderer.setStyle(
						document.documentElement,
						key,
						value,
					);
				}

				previousColors = Object.keys(colors);
				this.localStorageService.set(CUSTOM_COLORS_KEY, colors);
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

	public setCustomColors(colors: CustomColors): void {
		this.customColors.set(colors);
	}

	public updateCustomColor(property: string, value: string | null): void {
		this.customColors.update((current) => {
			const next = { ...current };
			if (value) {
				next[property] = value;
			} else {
				delete next[property];
			}
			return next;
		});
	}

	public clearCustomColors(): void {
		this.customColors.set({});
	}

	public exportCustomColorsAsJson(): void {
		if (!isPlatformBrowser(this.platformId)) return;

		const colors = this.customColors();
		const dataStr = JSON.stringify(colors, null, 2);
		const blob = new Blob([dataStr], { type: 'application/json' });
		const url = window.URL.createObjectURL(blob);

		const linkElement = document.createElement('a');
		linkElement.href = url;
		linkElement.download = 'gatuno-custom-colors.json';
		document.body.appendChild(linkElement);
		linkElement.click();

		document.body.removeChild(linkElement);
		window.URL.revokeObjectURL(url);
	}

	public async importCustomColorsFromJson(file: File): Promise<void> {
		if (!isPlatformBrowser(this.platformId)) return;

		try {
			const text = await file.text();
			const parsed = JSON.parse(text);

			if (
				typeof parsed !== 'object' ||
				parsed === null ||
				Array.isArray(parsed)
			) {
				throw new Error('Formato de arquivo inválido.');
			}

			const validColors: CustomColors = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (typeof key === 'string' && typeof value === 'string') {
					validColors[key] = value;
				}
			}

			this.setCustomColors(validColors);
		} catch (error) {
			console.error('Erro ao importar cores:', error);
			throw error;
		}
	}
}
