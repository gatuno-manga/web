import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '@service/settings.service';
import { ReaderSettings } from '@models/settings.models';
import { IconsComponent } from '@components/icons/icons.component';

@Component({
    selector: 'app-reader-settings-notification',
    standalone: true,
    imports: [CommonModule, FormsModule, IconsComponent],
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
        showPageNumbers: false
    };

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

    resetSettings(): void {
        this.settingsService.resetSettings();
        this.settings = { ...this.settingsService.getSettings() };
    }
}
