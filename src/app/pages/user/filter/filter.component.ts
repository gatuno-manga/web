import {
	Component,
	ChangeDetectionStrategy,
	signal,
	inject,
	OnInit,
	input,
	computed,
} from '@angular/core';
import { SensitiveContentResponse } from '../../../models/book.models';
import { SensitiveContentService } from '../../../service/sensitive-content.service';
import { MetaDataService } from '../../../service/meta-data.service';
import { DownloadService } from '../../../service/download.service';
import { TagsService } from '../../../service/tags.service';
import { Tag } from '../../../models/tags.models';
import { TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { SwitchComponent } from '../../../components/inputs/switch/switch.component';
import { SearchService } from '../../../service/search.service';
import { finalize } from 'rxjs/operators';

@Component({
	selector: 'app-filter',
	standalone: true,
	imports: [TextInputComponent, SwitchComponent],
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
	allowContent = signal<string[]>([]);

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

	filteredTags = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return this.tagsList().filter((tag) =>
			tag.name.toLowerCase().includes(q),
		);
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
		this.allowContent.set(this.sensitiveContentService.getContentAllow());
		this.loadSensitiveContent();
		this.loadTags();
		this.setMetaData();
	}

	loadTags() {
		this.tagsService.getAllTags().subscribe({
			next: (tags) => this.tagsList.set(tags),
			error: (err) => console.error('Error loading tags', err),
		});
	}

	loadSensitiveContent() {
		this.isLoading.set(true);
		this.sensitiveContentService
			.getSensitiveContent()
			.pipe(finalize(() => this.isLoading.set(false)))
			.subscribe({
				next: (list: SensitiveContentResponse[]) => {
					this.sensitiveContentList.update((current) => [
						...current,
						...list,
					]);
				},
				error: async () => {
					try {
						const offlineBooks =
							await this.downloadService.getAllBooks();
						const contentMap = new Map<
							string,
							SensitiveContentResponse
						>();

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
						console.error(
							'Error loading offline sensitive content',
							e,
						);
					}
				},
			});
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Filtro',
			description: 'Gerencie suas preferências de conteúdo sensível.',
		});
	}

	toggleContentAllow(content: SensitiveContentResponse): void {
		this.allowContent.update((current) => {
			const name = content.name;
			const index = current.indexOf(name);
			const newList = [...current];
			if (index > -1) {
				newList.splice(index, 1);
			} else {
				newList.push(name);
			}
			this.sensitiveContentService.setContentAllow(newList);
			return newList;
		});
	}

	isTagSelected(tagId: string): boolean {
		return this.selectedTags().includes(tagId);
	}

	toggleTag(tagId: string): void {
		this.selectedTags.update((current) =>
			current.includes(tagId)
				? current.filter((id) => id !== tagId)
				: [...current, tagId],
		);
	}

	isBookTypeSelected(typeId: string): boolean {
		return this.selectedBookTypes().includes(typeId);
	}

	toggleBookType(typeId: string): void {
		this.selectedBookTypes.update((current) =>
			current.includes(typeId)
				? current.filter((id) => id !== typeId)
				: [...current, typeId],
		);
	}
}
