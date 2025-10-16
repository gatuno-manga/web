import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LocalStorageService } from './local-storage.service';
import { ReaderSettings, DEFAULT_SETTINGS } from '../models/settings.models';

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private readonly SETTINGS_KEY = 'reader-settings';
    private settingsSubject: BehaviorSubject<ReaderSettings>;
    public settings$: Observable<ReaderSettings>;

    constructor(private localStorageService: LocalStorageService) {
        const savedSettings = this.loadSettings();
        this.settingsSubject = new BehaviorSubject<ReaderSettings>(savedSettings);
        this.settings$ = this.settingsSubject.asObservable();
    }

    private loadSettings(): ReaderSettings {
        const saved = this.localStorageService.get(this.SETTINGS_KEY);
        if (saved) {
            try {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
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
        const currentSettings = this.settingsSubject.value;
        const newSettings = { ...currentSettings, ...settings };
        this.settingsSubject.next(newSettings);
        this.saveSettings(newSettings);
    }

    private saveSettings(settings: ReaderSettings): void {
        this.localStorageService.set(this.SETTINGS_KEY, JSON.stringify(settings));
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
}
