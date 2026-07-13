import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	OnInit,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '@core/services/language.service';
import { LocalStorageService } from '@core/services/local-storage.service';
import { MetaDataService } from '@core/services/meta-data.service';
import { SearchService } from '@core/services/search.service';
import { SettingsService } from '@core/services/settings.service';
import { AppTheme, ThemeService } from '@core/services/theme.service';
import {
	BookListSettings,
	DEFAULT_BOOK_LIST_SETTINGS,
	ReaderSettings,
} from '@models/settings.models';
import { SelectComponent } from '@ui/atoms/inputs/select/select.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';

@Component({
	selector: 'app-appearance',
	standalone: true,
	imports: [TextInputComponent, SelectComponent, FormsModule, CommonModule],
	templateUrl: './appearance.component.html',
	styleUrl: './appearance.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceComponent implements OnInit {
	private readonly metaService = inject(MetaDataService);
	private readonly searchService = inject(SearchService);
	private readonly localStorage = inject(LocalStorageService);
	private readonly settingsService = inject(SettingsService);
	public readonly themeService = inject(ThemeService);
	public readonly languageService = inject(LanguageService);

	isListView = input<boolean>(false);
	private globalSearchQuery = this.searchService.query;

	bookSettings = signal<BookListSettings>(DEFAULT_BOOK_LIST_SETTINGS);
	readerSettings = signal<ReaderSettings>(this.settingsService.getSettings());

	decimalSeparatorOptions = [
		{ value: ',', label: 'Vírgula (,)' },
		{ value: '.', label: 'Ponto (.)' },
		{ value: 'custom', label: 'Personalizado' },
	];

	customDecimalSeparator = '';
	isCustomDecimal = false;

	themes: { value: AppTheme; label: string }[] = [
		{ value: 'light', label: 'Claro' },
		{ value: 'dark', label: 'Escuro' },
		{ value: 'true-dark', label: 'True Dark (OLED)' },
		{ value: 'dracula', label: 'Dracula' },
		{ value: 'slate', label: 'Slate' },
	];

	languageOptions = computed(() =>
		this.languageService.languages().map((lang) => ({
			value: lang.code,
			label: lang.name,
		})),
	);

	showPage = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return 'aparência visual tema cores layout livros listagem idioma linguagem'.includes(
			q,
		);
	});

	constructor() {
		this.setMetaData();
	}

	ngOnInit() {
		const saved =
			this.localStorage.get<BookListSettings>('book-list-settings');
		if (saved) {
			this.bookSettings.set(saved);
		}
		this.refreshReaderSettings();
	}

	private refreshReaderSettings() {
		const settings = this.settingsService.getSettings();
		this.readerSettings.set(settings);
		const currentSeparator = settings.decimalSeparator || ',';
		if (currentSeparator !== ',' && currentSeparator !== '.') {
			this.isCustomDecimal = true;
			this.customDecimalSeparator = currentSeparator;
		} else {
			this.isCustomDecimal = false;
			this.customDecimalSeparator = '';
		}
	}

	get selectedDecimalOption() {
		if (this.isCustomDecimal) return 'custom';
		return this.readerSettings().decimalSeparator || ',';
	}

	onDecimalSeparatorChange(value: string) {
		if (value === 'custom') {
			this.isCustomDecimal = true;
		} else {
			this.isCustomDecimal = false;
			this.settingsService.setDecimalSeparator(value);
			this.refreshReaderSettings();
		}
	}

	onCustomDecimalSeparatorChange(value: string) {
		this.customDecimalSeparator = value;
		if (this.isCustomDecimal && value) {
			this.settingsService.setDecimalSeparator(value);
			this.readerSettings.set(this.settingsService.getSettings());
		}
	}

	onThemeChangeFromSelect(value: string) {
		this.themeService.setTheme(value as AppTheme);
	}

	onLanguageChange(value: string) {
		this.languageService.setLanguage(value);
	}

	onModeChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		this.updateBookSettings({
			listMode: select.value as 'pagination' | 'infinite-scroll',
		});
	}

	onModeChangeFromSelect(value: string) {
		this.updateBookSettings({
			listMode: value as 'pagination' | 'infinite-scroll',
		});
	}

	onLimitChange(event: Event) {
		const input = event.target as HTMLInputElement;
		this.updateBookSettings({ limit: Number.parseInt(input.value, 10) });
	}

	onLimitChangeFromInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const val = Number.parseInt(input.value, 10);
		if (!Number.isNaN(val)) {
			this.updateBookSettings({ limit: val });
		}
	}

	private updateBookSettings(settings: Partial<BookListSettings>) {
		this.bookSettings.update((curr) => {
			const newValue = { ...curr, ...settings };
			this.localStorage.set('book-list-settings', newValue);
			return newValue;
		});
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Aparência',
			description: 'Mude como as coisas do seu aplicativo se parecem.',
		});
	}
}
