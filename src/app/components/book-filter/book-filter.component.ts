import {
	Component,
	EventEmitter,
	Input,
	OnInit,
	Output,
	signal,
	inject,
	computed,
} from '@angular/core';
import { ButtonComponent } from '../inputs/button/button.component';
import { TextInputComponent } from '../inputs/text-input/text-input.component';
import { SelectComponent } from '../inputs/select/select.component';
import {
	BookPageOptions,
	TypeBook,
	TagResponse,
	SensitiveContentResponse,
} from '../../models/book.models';
import { IconsComponent } from '@components/icons/icons.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagsService } from '../../service/tags.service';
import { SensitiveContentService } from '../../service/sensitive-content.service';
import { NotificationService } from '../../service/notification.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import {
	RandomFilterModalComponent,
	RandomFilterResult,
} from '../notification/custom-components/random-filter-modal/random-filter-modal.component';
import { Observable, tap } from 'rxjs';

interface ActiveFilter {
	id: string;
	label: string;
	type: string;
	value: string | TypeBook | number | undefined;
}

@Component({
	selector: 'app-book-filter',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ButtonComponent,
		TextInputComponent,
		SelectComponent,
		IconsComponent,
	],
	templateUrl: './book-filter.component.html',
	styleUrl: './book-filter.component.scss',
})
export class BookFilterComponent implements OnInit {
	private tagsService = inject(TagsService);
	private sensitiveContentService = inject(SensitiveContentService);
	private notificationService = inject(NotificationService);
	private modalService = inject(ModalNotificationService);

	@Input() initialFilters?: Partial<BookPageOptions>;
	@Output() filtersChange = new EventEmitter<Partial<BookPageOptions>>();

	// Search
	searchValue = signal<string>('');

	// Lists
	availableTypes = Object.values(TypeBook).map((type) => ({
		value: type,
		label: type.toUpperCase(),
	}));

	// API Data
	availableTags = signal<TagResponse[]>([]);
	availableSensitiveContent = signal<SensitiveContentResponse[]>([]);

	sortOptions = [
		{ value: 'createdAt', label: 'Mais Recente' },
		{ value: 'title', label: 'Título' },
		{ value: 'updatedAt', label: 'Atualização' },
		{ value: 'publication', label: 'Publicação' },
	];

	publicationOperators = [
		{ value: 'lt', label: 'Antes de' },
		{ value: 'gt', label: 'Depois de' },
		{ value: 'eq', label: 'Em' },
		{ value: 'lte', label: 'Até' },
		{ value: 'gte', label: 'A partir de' },
	];

	includeLogicOptions = [
		{ value: 'or', label: 'Contém QUALQUER tag (Selecionadas)' },
		{ value: 'and', label: 'Contém TODAS as tags (Selecionadas)' },
	];

	excludeLogicOptions = [
		{ value: 'or', label: 'Não contém QUALQUER tag (Excluídas)' },
		{ value: 'and', label: 'Não contém TODAS as tags (Excluídas)' },
	];

	// Type filters
	selectedTypes = signal<TypeBook[]>([]);

	// Tag filters
	selectedTags = signal<string[]>([]);
	tagsLogic = signal<'and' | 'or'>('or');
	excludedTags = signal<string[]>([]);
	excludeTagsLogic = signal<'and' | 'or'>('or');

	// Sensitive Content filters
	selectedSensitiveContent = signal<string[]>([]);

	// Author filters
	selectedAuthors = signal<string[]>([]);
	authorsLogic = signal<'and' | 'or'>('or');

	// Publication filters
	publicationYear = signal<number | undefined>(undefined);
	publicationOperator = signal<'eq' | 'gt' | 'lt' | 'gte' | 'lte'>('lt');

	// Sorting
	orderBy = signal<'title' | 'createdAt' | 'updatedAt' | 'publication'>(
		'createdAt',
	);
	order = signal<'ASC' | 'DESC'>('DESC');

	// UI state
	showAdvancedFilters = signal<boolean>(false);
	loadingTags = signal<boolean>(false);
	private pendingSensitiveNames = signal<string[]>([]);

	activeFilters = computed(() => {
		const filters: ActiveFilter[] = [];

		if (this.searchValue()) {
			filters.push({
				id: 'search',
				label: `Busca: ${this.searchValue()}`,
				type: 'search',
				value: this.searchValue(),
			});
		}

		for (const type of this.selectedTypes()) {
			filters.push({
				id: `type-${type}`,
				label: type.toUpperCase(),
				type: 'type',
				value: type,
			});
		}

		for (const tagId of this.selectedTags()) {
			const tag = this.availableTags().find((t) => t.id === tagId);
			if (tag) {
				filters.push({
					id: `tag-${tagId}`,
					label: `${tag.name} (${this.tagsLogic().toUpperCase()})`,
					type: 'tag',
					value: tagId,
				});
			}
		}

		for (const tagId of this.excludedTags()) {
			const tag = this.availableTags().find((t) => t.id === tagId);
			if (tag) {
				filters.push({
					id: `exclude-tag-${tagId}`,
					label: `Não: ${tag.name} (${this.excludeTagsLogic().toUpperCase()})`,
					type: 'excludeTag',
					value: tagId,
				});
			}
		}

		for (const id of this.selectedSensitiveContent()) {
			const content = this.availableSensitiveContent().find(
				(c) => c.id === id,
			);
			if (content) {
				filters.push({
					id: `sensitive-${id}`,
					label: content.name,
					type: 'sensitive',
					value: id,
				});
			}
		}

		if (this.publicationYear()) {
			const operatorLabel = this.publicationOperators.find(
				(o) => o.value === this.publicationOperator(),
			)?.label;
			filters.push({
				id: 'publication',
				label: `Ano: ${operatorLabel} ${this.publicationYear()}`,
				type: 'publication',
				value: this.publicationYear(),
			});
		}

		for (const authorId of this.selectedAuthors()) {
			filters.push({
				id: `author-${authorId}`,
				label: `Autor ID: ${authorId} (${this.authorsLogic().toUpperCase()})`,
				type: 'author',
				value: authorId,
			});
		}

		return filters;
	});

	ngOnInit() {
		if (this.initialFilters) {
			this.loadFilters(this.initialFilters);
		}
		this.fetchData();
	}

	private fetchData() {
		this.sensitiveContentService
			.getSensitiveContent()
			.subscribe((content) => {
				const allowedNames =
					this.sensitiveContentService.getContentAllow();
				// Filter available options based on allowed content
				const filteredContent = content.filter((c) =>
					allowedNames.includes(c.name),
				);

				// Adicionar categoria "safe" manualmente (não vem da API)
				const safeCategory: SensitiveContentResponse = {
					id: 'safe',
					name: 'safe',
				};

				this.availableSensitiveContent.set([
					safeCategory,
					...filteredContent,
				]);

				// Reconcile pending sensitive names (if any) to IDs
				const pending = this.pendingSensitiveNames();
				if (pending.length > 0) {
					const allContent = [safeCategory, ...filteredContent];
					const ids = allContent
						.filter((c) => pending.includes(c.name))
						.map((c) => c.id);
					this.selectedSensitiveContent.set(ids);
					this.pendingSensitiveNames.set([]); // Clear pending
				}

				// Load tags after we have the sensitive content names mapping
				this.fetchTags();
			});
	}

	private getTagsObservable(): Observable<TagResponse[]> {
		this.loadingTags.set(true);

		const selectedIds = this.selectedSensitiveContent();
		let sensitiveContent: string[];

		console.log('Selected Sensitive Content IDs:', selectedIds);

		if (selectedIds.length > 0) {
			// Map selected IDs to their names for the API call
			sensitiveContent = this.availableSensitiveContent()
				.filter((content) => selectedIds.includes(content.id))
				.map((content) => content.name);
		} else {
			// If nothing selected, use ALL available (allowed) sensitive content
			sensitiveContent = this.availableSensitiveContent().map(
				(content) => content.name,
			);
		}

		return this.tagsService.getTags({ sensitiveContent }).pipe(
			tap({
				next: (tags) => {
					this.availableTags.set(tags);
					this.loadingTags.set(false);
				},
				error: () => {
					this.loadingTags.set(false);
				},
			}),
		);
	}

	private fetchTags() {
		this.getTagsObservable().subscribe();
	}

	private loadFilters(filters: Partial<BookPageOptions>) {
		if (filters.search) this.searchValue.set(filters.search);
		if (filters.type) this.selectedTypes.set(filters.type);
		if (filters.tags) this.selectedTags.set(filters.tags);
		if (filters.tagsLogic) this.tagsLogic.set(filters.tagsLogic);
		if (filters.excludeTags) this.excludedTags.set(filters.excludeTags);
		if (filters.excludeTagsLogic)
			this.excludeTagsLogic.set(filters.excludeTagsLogic);
		if (filters.authors) this.selectedAuthors.set(filters.authors);
		if (filters.authorsLogic) this.authorsLogic.set(filters.authorsLogic);
		if (filters.publication) this.publicationYear.set(filters.publication);
		if (filters.publicationOperator)
			this.publicationOperator.set(filters.publicationOperator);
		if (filters.orderBy) this.orderBy.set(filters.orderBy);
		if (filters.order) this.order.set(filters.order);
		if (filters.sensitiveContent) {
			this.pendingSensitiveNames.set(filters.sensitiveContent);
		}
	}

	removeFilter(filter: ActiveFilter) {
		if (filter.type === 'search') {
			this.searchValue.set('');
		} else if (filter.type === 'type') {
			this.selectedTypes.update((types) =>
				types.filter((t) => t !== filter.value),
			);
		} else if (filter.type === 'tag') {
			this.selectedTags.update((tags) =>
				tags.filter((t) => t !== filter.value),
			);
		} else if (filter.type === 'excludeTag') {
			this.excludedTags.update((tags) =>
				tags.filter((t) => t !== filter.value),
			);
		} else if (filter.type === 'sensitive') {
			this.selectedSensitiveContent.update((content) =>
				content.filter((c) => c !== filter.value),
			);
			this.fetchTags();
		} else if (filter.type === 'publication') {
			this.publicationYear.set(undefined);
		} else if (filter.type === 'author') {
			this.selectedAuthors.update((authors) =>
				authors.filter((a) => a !== filter.value),
			);
		}
		this.emitFilters();
	}

	onSearch() {
		this.emitFilters();
	}

	onSearchClick = () => {
		this.onSearch();
	};

	onSearchInput(value: string) {
		this.searchValue.set(value);
	}

	toggleType(type: TypeBook) {
		this.selectedTypes.update((types) => {
			if (types.includes(type)) {
				return types.filter((t) => t !== type);
			}
			return [...types, type];
		});
	}

	toggleTag(tagId: string) {
		if (this.selectedTags().includes(tagId)) {
			// Move from Selected to Excluded
			this.selectedTags.update((tags) => tags.filter((t) => t !== tagId));
			this.excludedTags.update((tags) => [...tags, tagId]);
		} else if (this.excludedTags().includes(tagId)) {
			// Move from Excluded to None
			this.excludedTags.update((tags) => tags.filter((t) => t !== tagId));
		} else {
			// Move from None to Selected
			this.selectedTags.update((tags) => [...tags, tagId]);
		}
	}

	toggleSensitiveContent(id: string) {
		this.selectedSensitiveContent.update((content) => {
			if (content.includes(id)) {
				return content.filter((c) => c !== id);
			}
			return [...content, id];
		});
		this.fetchTags();
	}

	isTypeSelected(type: TypeBook): boolean {
		return this.selectedTypes().includes(type);
	}

	isTagSelected(tagId: string): boolean {
		return this.selectedTags().includes(tagId);
	}

	isTagExcluded(tagId: string): boolean {
		return this.excludedTags().includes(tagId);
	}

	isSensitiveContentSelected(id: string): boolean {
		return this.selectedSensitiveContent().includes(id);
	}

	onPublicationOperatorChange(value: string) {
		this.publicationOperator.set(
			value as 'eq' | 'gt' | 'lt' | 'gte' | 'lte',
		);
	}

	onPublicationYearChange(value: string) {
		const year = Number.parseInt(value);
		if (!Number.isNaN(year)) {
			this.publicationYear.set(year);
		} else {
			this.publicationYear.set(undefined);
		}
	}

	onSortChange(value: string) {
		this.orderBy.set(
			value as 'title' | 'createdAt' | 'updatedAt' | 'publication',
		);
	}

	onTagsLogicChange(value: string) {
		this.tagsLogic.set(value as 'and' | 'or');
	}

	onExcludeTagsLogicChange(value: string) {
		this.excludeTagsLogic.set(value as 'and' | 'or');
	}

	clearSearch() {
		this.searchValue.set('');
		this.emitFilters();
	}

	clearAllFilters() {
		this.searchValue.set('');
		this.selectedTypes.set([]);
		this.selectedTags.set([]);
		this.excludedTags.set([]);
		this.selectedSensitiveContent.set([]);
		this.selectedAuthors.set([]);
		this.publicationYear.set(undefined);
		this.emitFilters();
		this.fetchTags(); // Reset tags to default
	}

	toggleAdvancedFilters() {
		const wasOpen = this.showAdvancedFilters();
		this.showAdvancedFilters.set(!wasOpen);

		if (wasOpen) {
			this.emitFilters();
		}
	}

	applyFilters() {
		this.emitFilters();
	}

	private emitFilters(randomBook = false) {
		const filters: Partial<BookPageOptions> = {};

		if (this.searchValue()) filters.search = this.searchValue();
		if (this.selectedTypes().length > 0)
			filters.type = this.selectedTypes();
		if (this.selectedTags().length > 0) {
			filters.tags = this.selectedTags();
			filters.tagsLogic = this.tagsLogic();
		}
		if (this.excludedTags().length > 0) {
			filters.excludeTags = this.excludedTags();
			filters.excludeTagsLogic = this.excludeTagsLogic();
		}
		if (this.selectedAuthors().length > 0) {
			filters.authors = this.selectedAuthors();
			filters.authorsLogic = this.authorsLogic();
		}
		if (this.publicationYear()) {
			filters.publication = this.publicationYear();
			filters.publicationOperator = this.publicationOperator();
		}

		if (this.selectedSensitiveContent().length > 0) {
			// Map IDs back to Names for emission
			filters.sensitiveContent = this.availableSensitiveContent()
				.filter((c) => this.selectedSensitiveContent().includes(c.id))
				.map((c) => c.name);
		}

		filters.orderBy = this.orderBy();
		filters.order = this.order();
		filters.random = randomBook;

		this.filtersChange.emit(filters);
	}

	hasActiveFilters(): boolean {
		return (
			this.searchValue() !== '' ||
			this.selectedTypes().length > 0 ||
			this.selectedTags().length > 0 ||
			this.excludedTags().length > 0 ||
			this.selectedAuthors().length > 0 ||
			this.publicationYear() !== undefined ||
			this.selectedSensitiveContent().length > 0
		);
	}

	goToRandomBook() {
		this.emitFilters(true);
	}

	openRandomFiltersModal() {
		console.log('Opening Random Filters Modal');
		this.notificationService.notify({
			message: '',
			level: 'critical',
			title: 'Filtros Aleatórios',
			component: RandomFilterModalComponent,
			componentData: {
				close: (result: RandomFilterResult | null) => {
					this.modalService.close();
					if (result) {
						this.generateRandomFilters(result);
					}
				},
			},
			useBackdrop: true,
			backdropOpacity: 0.5,
		});
	}

	private generateRandomFilters(config: RandomFilterResult) {
		// 1. Reset everything manually
		this.searchValue.set('');
		this.selectedTypes.set([]);
		this.selectedTags.set([]);
		this.excludedTags.set([]);
		this.selectedSensitiveContent.set([]);
		this.selectedAuthors.set([]);
		this.publicationYear.set(undefined);

		// 2. Random Types
		if (config.types && this.availableTypes.length > 0) {
			const randomType =
				this.availableTypes[
					Math.floor(Math.random() * this.availableTypes.length)
				];
			this.selectedTypes.set([randomType.value]);
		}

		// 3. Random Sensitive Content
		if (config.sensitive && this.availableSensitiveContent().length > 0) {
			const randomContent =
				this.availableSensitiveContent()[
					Math.floor(
						Math.random() * this.availableSensitiveContent().length,
					)
				];
			this.selectedSensitiveContent.set([randomContent.id]);
		}

		// 4. Fetch Tags (based on new sensitive content) AND THEN Randomize Tags
		this.getTagsObservable().subscribe((tags) => {
			if (config.tags && tags.length > 0) {
				const count = Math.floor(Math.random() * 3) + 1;
				const shuffled = [...tags].sort(() => 0.5 - Math.random());
				const randomTags = shuffled.slice(0, count).map((t) => t.id);
				this.selectedTags.set(randomTags);
				this.tagsLogic.set('or');
			}
			// 5. Emit
			this.emitFilters();
		});
	}
}
