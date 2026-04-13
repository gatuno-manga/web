import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LocalStorageService } from './local-storage.service';
import { ReaderSettings, DEFAULT_SETTINGS } from '../models/settings.models';

const MIN_LINE_HEIGHT = 1;
const MAX_LINE_HEIGHT = 3;
const MIN_LETTER_SPACING = -2;
const MAX_LETTER_SPACING = 10;

@Injectable({
	providedIn: 'root',
})
export class SettingsService {
	private readonly SETTINGS_KEY = 'reader-settings';
	private settingsSubject: BehaviorSubject<ReaderSettings>;
	public settings$: Observable<ReaderSettings>;

	constructor(private localStorageService: LocalStorageService) {
		const savedSettings = this.loadSettings();
		this.settingsSubject = new BehaviorSubject<ReaderSettings>(
			savedSettings,
		);
		this.settings$ = this.settingsSubject.asObservable();
	}

	private clampDecimal(value: number, min: number, max: number): number {
		return +Math.min(max, Math.max(min, value)).toFixed(1);
	}

	private normalizeLineHeight(value?: number): number {
		const fallback = DEFAULT_SETTINGS.lineHeight ?? 1.8;
		if (typeof value !== 'number' || Number.isNaN(value)) {
			return fallback;
		}
		return this.clampDecimal(value, MIN_LINE_HEIGHT, MAX_LINE_HEIGHT);
	}

	private normalizeLetterSpacing(value?: number): number {
		const fallback = DEFAULT_SETTINGS.letterSpacing ?? 0;
		if (typeof value !== 'number' || Number.isNaN(value)) {
			return fallback;
		}
		return this.clampDecimal(value, MIN_LETTER_SPACING, MAX_LETTER_SPACING);
	}

	private normalizeSettings(settings: ReaderSettings): ReaderSettings {
		return {
			...settings,
			lineHeight: this.normalizeLineHeight(settings.lineHeight),
			letterSpacing: this.normalizeLetterSpacing(settings.letterSpacing),
		};
	}

	private normalizePartialSettings(
		settings: Partial<ReaderSettings>,
	): Partial<ReaderSettings> {
		const normalized: Partial<ReaderSettings> = { ...settings };

		if ('lineHeight' in normalized) {
			normalized.lineHeight = this.normalizeLineHeight(
				normalized.lineHeight,
			);
		}

		if ('letterSpacing' in normalized) {
			normalized.letterSpacing = this.normalizeLetterSpacing(
				normalized.letterSpacing,
			);
		}

		return normalized;
	}

	private loadSettings(): ReaderSettings {
		const saved = this.localStorageService.get(this.SETTINGS_KEY);
		if (saved) {
			try {
				const mergedSettings = {
					...DEFAULT_SETTINGS,
					...JSON.parse(saved),
				};
				return this.normalizeSettings(mergedSettings);
			} catch (error) {
				console.error('Erro ao carregar configurações:', error);
				return DEFAULT_SETTINGS;
			}
		}
		return DEFAULT_SETTINGS;
	}

	getSettings(): ReaderSettings {
		return this.settingsSubject.value;
	}

	updateSettings(settings: Partial<ReaderSettings>): void {
		const normalizedSettings = this.normalizePartialSettings(settings);
		const currentSettings = this.settingsSubject.value;
		const newSettings = { ...currentSettings, ...normalizedSettings };
		this.settingsSubject.next(newSettings);
		this.saveSettings(newSettings);
	}

	private saveSettings(settings: ReaderSettings): void {
		this.localStorageService.set(
			this.SETTINGS_KEY,
			JSON.stringify(settings),
		);
	}

	resetSettings(): void {
		this.settingsSubject.next(DEFAULT_SETTINGS);
		this.saveSettings(DEFAULT_SETTINGS);
	}

	toggleGrayScale(): void {
		const current = this.getSettings();
		this.updateSettings({ grayScale: !current.grayScale });
	}

	toggleShowPageNumbers(): void {
		const current = this.getSettings();
		this.updateSettings({ showPageNumbers: !current.showPageNumbers });
	}

	setAsidePosition(position: 'left' | 'right'): void {
		this.updateSettings({ asidePosition: position });
	}

	setLineHeight(lineHeight: number): void {
		this.updateSettings({ lineHeight });
	}

	setLetterSpacing(letterSpacing: number): void {
		this.updateSettings({ letterSpacing });
	}

	toggleBrightness150(): void {
		const current = this.getSettings();
		const newValue = current.brightness === 150 ? 100 : 150;
		this.updateSettings({ brightness: newValue });
	}

	toggleContrast150(): void {
		const current = this.getSettings();
		const newValue = current.contrast === 150 ? 100 : 150;
		this.updateSettings({ contrast: newValue });
	}

	toggleInvert(): void {
		const current = this.getSettings();
		const newValue = current.invert === 100 ? 0 : 100;
		this.updateSettings({ invert: newValue });
	}

	toggleNightMode(): void {
		const current = this.getSettings();
		if (current.nightMode) {
			this.updateSettings({
				nightMode: false,
				invert: DEFAULT_SETTINGS.invert,
				brightness: DEFAULT_SETTINGS.brightness,
				contrast: DEFAULT_SETTINGS.contrast,
			});
		} else {
			this.updateSettings({
				nightMode: true,
				invert: 100,
				brightness: 80,
				contrast: 120,
			});
		}
	}
}
