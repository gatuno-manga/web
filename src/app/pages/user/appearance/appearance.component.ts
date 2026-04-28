import {
	Component,
	ChangeDetectionStrategy,
	inject,
	input,
	computed,
	signal,
	OnInit,
} from '@angular/core';
import { MetaDataService } from '../../../service/meta-data.service';
import { SearchService } from '../../../service/search.service';
import { LocalStorageService } from '../../../service/local-storage.service';
import { ThemeService, AppTheme } from '../../../service/theme.service';
import {
	BookListSettings,
	DEFAULT_BOOK_LIST_SETTINGS,
} from '../../../models/settings.models';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { SelectComponent } from '../../../components/inputs/select/select.component';
import { FormsModule } from '@angular/forms';

@Component({
	selector: 'app-appearance',
	standalone: true,
	imports: [
		TextInputComponent,
		SelectComponent,
		FormsModule,
	],
	templateUrl: './appearance.component.html',
	styleUrl: './appearance.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceComponent implements OnInit {
	private readonly metaService = inject(MetaDataService);
	private readonly searchService = inject(SearchService);
	private readonly localStorage = inject(LocalStorageService);
	public readonly themeService = inject(ThemeService);

	isListView = input<boolean>(false);
	private globalSearchQuery = this.searchService.query;

	bookSettings = signal<BookListSettings>(DEFAULT_BOOK_LIST_SETTINGS);

	themes: { value: AppTheme; label: string }[] = [
		{ value: 'light', label: 'Claro' },
		{ value: 'dark', label: 'Escuro' },
		{ value: 'true-dark', label: 'True Dark (OLED)' },
	];

	showPage = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return 'aparência visual tema cores layout livros listagem'.includes(q);
	});

	constructor() {
		this.setMetaData();
	}

	ngOnInit() {
		const saved = this.localStorage.get<BookListSettings>(
			'book-list-settings',
		);
		if (saved) {
			this.bookSettings.set(saved);
		}
	}

	onThemeChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		this.themeService.setTheme(select.value as AppTheme);
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
