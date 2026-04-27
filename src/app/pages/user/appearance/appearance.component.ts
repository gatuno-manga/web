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
import {
	BookListSettings,
	DEFAULT_BOOK_LIST_SETTINGS,
} from '../../../models/settings.models';

@Component({
	selector: 'app-appearance',
	standalone: true,
	imports: [],
	templateUrl: './appearance.component.html',
	styleUrl: './appearance.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceComponent implements OnInit {
	private readonly metaService = inject(MetaDataService);
	private readonly searchService = inject(SearchService);
	private readonly localStorage = inject(LocalStorageService);

	isListView = input<boolean>(false);
	private globalSearchQuery = this.searchService.query;

	bookSettings = signal<BookListSettings>(DEFAULT_BOOK_LIST_SETTINGS);

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

	onModeChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		this.updateBookSettings({
			listMode: select.value as 'pagination' | 'infinite-scroll',
		});
	}

	onLimitChange(event: Event) {
		const input = event.target as HTMLInputElement;
		this.updateBookSettings({ limit: Number.parseInt(input.value, 10) });
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
