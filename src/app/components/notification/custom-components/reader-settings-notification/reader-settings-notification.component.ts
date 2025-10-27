import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '@service/settings.service';
import { ReaderSettings } from '@models/settings.models';
import { IconsComponent } from '@components/icons/icons.component';
import { SelectComponent } from '@components/inputs/select/select.component';
import { ButtonComponent } from '@components/inputs/button/button.component';

@Component({
    selector: 'app-reader-settings-notification',
    standalone: true,
    imports: [CommonModule, FormsModule, IconsComponent, SelectComponent, ButtonComponent],
    templateUrl: './reader-settings-notification.component.html',
    styleUrls: ['./reader-settings-notification.component.scss']
})
export class ReaderSettingsNotificationComponent implements OnInit {
    @Input() title: string = 'Configurações do Leitor';
    @Input() subtitle: string = 'Personalize sua experiência de leitura';
    @Input() showResetButton: boolean = true;

    settings: ReaderSettings = {
        grayScale: false,
        asidePosition: 'right',
        showPageNumbers: false,
        brightness: 100,
        contrast: 100,
        invert: 0,
        nightMode: false
    };

    viewFilter: 'all' | 'pages' | 'filters' | 'sidebar' = 'all';

    get showSidebar() {
        return this.viewFilter === 'all' || this.viewFilter === 'sidebar';
    }

    get showPages() {
        return this.viewFilter === 'all' || this.viewFilter === 'pages';
    }

    get showFilters() {
        return this.viewFilter === 'all' || this.viewFilter === 'filters';
    }

    setView(filter: 'all' | 'pages' | 'filters' | 'sidebar') {
        this.viewFilter = filter;
    }

    constructor(private settingsService: SettingsService) {}

    ngOnInit(): void {
        this.settings = { ...this.settingsService.getSettings() };
    }

    onGrayScaleChange(): void {
        this.settingsService.updateSettings({ grayScale: this.settings.grayScale });
    }

    onAsidePositionChange(): void {
        this.settingsService.updateSettings({ asidePosition: this.settings.asidePosition });
    }

    onShowPageNumbersChange(): void {
        this.settingsService.updateSettings({ showPageNumbers: this.settings.showPageNumbers });
    }

    // novos handlers para filtros/toggles
    onBrightnessToggle(eventOrValue: Event | boolean): void {
        const active = typeof eventOrValue === 'boolean' ? eventOrValue : (eventOrValue?.target as HTMLInputElement)?.checked;
        this.settingsService.updateSettings({ brightness: active ? 150 : 100 });
        this.settings.brightness = active ? 150 : 100;
    }

    onContrastToggle(eventOrValue: Event | boolean): void {
        const active = typeof eventOrValue === 'boolean' ? eventOrValue : (eventOrValue?.target as HTMLInputElement)?.checked;
        this.settingsService.updateSettings({ contrast: active ? 150 : 100 });
        this.settings.contrast = active ? 150 : 100;
    }

    onInvertToggle(eventOrValue: Event | boolean): void {
        const active = typeof eventOrValue === 'boolean' ? eventOrValue : (eventOrValue?.target as HTMLInputElement)?.checked;
        this.settingsService.updateSettings({ invert: active ? 100 : 0 });
        this.settings.invert = active ? 100 : 0;
    }

    onNightModeToggle(eventOrValue: Event | boolean): void {
        // aceita tanto o boolean vindo do ngModel quanto o Event do change
        const active = typeof eventOrValue === 'boolean' ? eventOrValue : (eventOrValue?.target as HTMLInputElement)?.checked;
        if (active) {
            this.settingsService.updateSettings({ nightMode: true, invert: 100, brightness: 80, contrast: 120 });
        } else {
            this.settingsService.updateSettings({ nightMode: false, invert: 0, brightness: 100, contrast: 100 });
        }
        this.settings = { ...this.settingsService.getSettings() };
    }

    resetSettings(): void {
        this.settingsService.resetSettings();
        this.settings = { ...this.settingsService.getSettings() };
    }
}
