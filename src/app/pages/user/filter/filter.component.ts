import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	OnInit,
	signal,
} from '@angular/core';
import { DownloadService } from '@core/services/download.service';
import { MetaDataService } from '@core/services/meta-data.service';
import { SearchService } from '@core/services/search.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { TagsService } from '@core/services/tags.service';
import { SensitiveContentResponse } from '@models/book.models';
import { Tag } from '@models/tags.models';
import { MultiSelectTagsComponent } from '@ui/organisms/multi-select-tags/multi-select-tags.component';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'app-filter',
	standalone: true,
	imports: [MultiSelectTagsComponent],
	templateUrl: './filter.component.html',
	styleUrl: './filter.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterComponent implements OnInit {
	private readonly sensitiveContentService = inject(SensitiveContentService);
	private readonly metaService = inject(MetaDataService);
	private readonly downloadService = inject(DownloadService);
	private readonly tagsService = inject(TagsService);
	private readonly searchService = inject(SearchService);

	isListView = input<boolean>(false);
	private globalSearchQuery = this.searchService.query;

	sensitiveContentList = signal<SensitiveContentResponse[]>([
		{ id: '1', name: 'safe' },
	]);
	allowContentIds = signal<string[]>([]);
	private isInitialized = signal<boolean>(false);
	private initialAllowedNames: string[] = [];

	tagsList = signal<Tag[]>([]);
	selectedTags = signal<string[]>([]);

	bookTypesList = signal<{ id: string; name: string }[]>([
		{ id: 'manga', name: 'Manga' },
		{ id: 'manhwa', name: 'Manhwa' },
		{ id: 'manhua', name: 'Manhua' },
		{ id: 'novel', name: 'Novel' },
	]);
	selectedBookTypes = signal<string[]>([]);

	isLoading = signal<boolean>(false);
	tagSearchQuery = signal<string>('');

	filteredTags = computed(() => {
		const globalQ = this.globalSearchQuery().toLowerCase();
		const localQ = this.tagSearchQuery().toLowerCase();

		return this.tagsList()
			.filter(
				(tag) =>
					tag.name.toLowerCase().includes(globalQ) &&
					tag.name.toLowerCase().includes(localQ),
			)
			.slice(0, 15);
	});

	filteredBookTypes = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return this.bookTypesList().filter((type) =>
			type.name.toLowerCase().includes(q),
		);
	});

	filteredSensitiveContent = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return this.sensitiveContentList().filter((content) =>
			content.name.toLowerCase().includes(q),
		);
	});

	ngOnInit() {
		this.initialAllowedNames =
			this.sensitiveContentService.getContentAllow();
		this.selectedTags.set(this.tagsService.excludedTagsSignal());
		this.loadSensitiveContent();
		this.loadTags();
		this.setMetaData();
	}

	constructor() {
		effect(() => {
			if (!this.isInitialized()) return;

			const ids = this.allowContentIds();
			const names = this.sensitiveContentList()
				.filter((c) => ids.includes(c.id))
				.map((c) => c.name);

			// Sincroniza globalmente com o serviço usando os nomes
			this.sensitiveContentService.setContentAllow(names);

			// Recarrega as tags baseadas no novo conteúdo permitido
			this.loadTags(names);
		});

		effect(() => {
			const excluded = this.selectedTags();
			this.tagsService.setExcludedTags(excluded);
		});
	}

	async loadTags(allowedNames?: string[]) {
		const sensitiveContent =
			allowedNames || this.sensitiveContentService.getContentAllow();
		try {
			const tags = await firstValueFrom(
				this.tagsService.getTags({ sensitiveContent }),
			);
			this.tagsList.set(tags);
		} catch (err) {
			console.error('Error loading tags', err);
		}
	}

	private mapNamesToIds() {
		const ids = this.sensitiveContentList()
			.filter((c) => this.initialAllowedNames.includes(c.name))
			.map((c) => c.id);

		this.allowContentIds.set(ids);
		this.isInitialized.set(true);
	}

	async loadSensitiveContent() {
		this.isLoading.set(true);
		try {
			const list = await firstValueFrom(
				this.sensitiveContentService.getSensitiveContent(),
			);
			this.sensitiveContentList.update((current) => [
				...current,
				...list,
			]);
			this.mapNamesToIds();
		} catch (_err) {
			try {
				const offlineBooks = await this.downloadService.getAllBooks();
				const contentMap = new Map<string, SensitiveContentResponse>();

				for (const book of offlineBooks) {
					if (book.sensitiveContent) {
						for (const sc of book.sensitiveContent) {
							contentMap.set(sc.id, sc);
						}
					}
				}

				const offlineList = Array.from(contentMap.values());
				this.sensitiveContentList.update((current) => [
					...current,
					...offlineList,
				]);
			} catch (e) {
				console.error('Error loading offline sensitive content', e);
			} finally {
				this.mapNamesToIds();
			}
		} finally {
			this.isLoading.set(false);
		}
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Filtro',
			description: 'Gerencie suas preferências de conteúdo sensível.',
		});
	}
}
