import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../service/settings.service';
import { ReaderSettings } from '../../../models/settings.models';
import { IconsComponent } from '../../icons/icons.component';
import { SelectComponent } from '../../inputs/select/select.component';
import { ButtonComponent } from '../../inputs/button/button.component';
import { SwitchComponent } from '../../inputs/switch/switch.component';

@Component({
	selector: 'app-reader-settings-form',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		IconsComponent,
		SelectComponent,
		ButtonComponent,
		SwitchComponent,
	],
	templateUrl: './reader-settings-form.component.html',
	styleUrls: ['./reader-settings-form.component.scss'],
})
export class ReaderSettingsFormComponent implements OnInit {
	@Input() contentType: 'image' | 'text' | 'document' | 'all' = 'all';
	@Input() showResetButton = true;

	private settingsService = inject(SettingsService);

	settings: ReaderSettings = {
		grayScale: false,
		asidePosition: 'right',
		progressBarPosition: 'top',
		showPageNumbers: false,
		brightness: 100,
		contrast: 100,
		invert: 0,
		nightMode: false,
		fontSize: 18,
		fontFamily: 'sans-serif',
		lineHeight: 1.8,
		letterSpacing: 0,
		textAlign: 'justify',
	};

	viewFilter: 'all' | 'pages' | 'filters' | 'sidebar' | 'text' = 'all';

	fontFamilyOptions = [
		{ value: 'system-ui, -apple-system, sans-serif', label: 'Sans Serif' },
		{ value: 'Georgia, serif', label: 'Serif' },
		{ value: 'monospace', label: 'Monospace' },
		{ value: "'Inknut Antiqua', serif", label: 'Inknut Antiqua' },
	];

	ngOnInit(): void {
		this.refreshLocalSettings();
		// Se o tipo for texto, a aba padrão deve ser texto ou all
		if (this.contentType === 'text') {
			this.viewFilter = 'text';
		} else if (this.contentType === 'all') {
			this.viewFilter = 'all';
		}
	}

	private refreshLocalSettings() {
		this.settings = { ...this.settingsService.getSettings() };
	}

	get showSidebar() {
		return this.viewFilter === 'all' || this.viewFilter === 'sidebar';
	}

	get showPages() {
		return (
			(this.viewFilter === 'all' || this.viewFilter === 'pages') &&
			(this.contentType === 'image' ||
				this.contentType === 'document' ||
				this.contentType === 'all')
		);
	}

	get showFilters() {
		return (
			(this.viewFilter === 'all' || this.viewFilter === 'filters') &&
			(this.contentType === 'image' || this.contentType === 'all')
		);
	}

	get showTextSettings() {
		return (
			(this.viewFilter === 'all' || this.viewFilter === 'text') &&
			(this.contentType === 'text' || this.contentType === 'all')
		);
	}

	setView(filter: 'all' | 'pages' | 'filters' | 'sidebar' | 'text') {
		this.viewFilter = filter;
	}

	onGrayScaleChange(): void {
		this.settingsService.toggleGrayScale();
		this.refreshLocalSettings();
	}

	onAsidePositionChange(value: string): void {
		this.settingsService.setAsidePosition(value as 'left' | 'right');
		this.refreshLocalSettings();
	}

	onShowPageNumbersChange(): void {
		this.settingsService.toggleShowPageNumbers();
		this.refreshLocalSettings();
	}

	onProgressBarPositionChange(value: string): void {
		this.settingsService.updateSettings({
			progressBarPosition: value as 'top' | 'bottom',
		});
		this.refreshLocalSettings();
	}

	onBrightnessToggle(eventOrValue: Event | boolean): void {
		this.settingsService.toggleBrightness150();
		this.refreshLocalSettings();
	}

	onContrastToggle(eventOrValue: Event | boolean): void {
		this.settingsService.toggleContrast150();
		this.refreshLocalSettings();
	}

	onInvertToggle(eventOrValue: Event | boolean): void {
		this.settingsService.toggleInvert();
		this.refreshLocalSettings();
	}

	onNightModeToggle(eventOrValue: Event | boolean): void {
		this.settingsService.toggleNightMode();
		this.refreshLocalSettings();
	}

	onTextSettingChange(field?: keyof ReaderSettings, value?: unknown) {
		if (field && value !== undefined) {
			this.settingsService.updateSettings({
				[field]: value,
			} as Partial<ReaderSettings>);
		} else {
			this.settingsService.updateSettings({
				fontSize: this.settings.fontSize,
				fontFamily: this.settings.fontFamily,
				lineHeight: this.settings.lineHeight,
				letterSpacing: this.settings.letterSpacing,
				textAlign: this.settings.textAlign,
			});
		}
		this.refreshLocalSettings();
	}

	private parseSpacingValue(
		value: number | string,
		fallback: number,
	): number {
		const parsed =
			typeof value === 'number'
				? value
				: Number.parseFloat(String(value));
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	onLineHeightChange(value: number | string) {
		const fallback = this.settings.lineHeight ?? 1.8;
		const lineHeight = this.parseSpacingValue(value, fallback);
		this.settingsService.setLineHeight(lineHeight);
		this.refreshLocalSettings();
	}

	onLetterSpacingChange(value: number | string) {
		const fallback = this.settings.letterSpacing ?? 0;
		const letterSpacing = this.parseSpacingValue(value, fallback);
		this.settingsService.setLetterSpacing(letterSpacing);
		this.refreshLocalSettings();
	}

	updateLineHeight(delta: number) {
		const current = this.settings.lineHeight || 1.8;
		const newValue = +(current + delta).toFixed(1);
		this.onLineHeightChange(newValue);
	}

	updateLetterSpacing(delta: number) {
		const current = this.settings.letterSpacing || 0;
		const newValue = +(current + delta).toFixed(1);
		this.onLetterSpacingChange(newValue);
	}

	resetSettings(): void {
		this.settingsService.resetSettings();
		this.settings = { ...this.settingsService.getSettings() };
	}
}
