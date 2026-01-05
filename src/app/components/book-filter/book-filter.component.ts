import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { IconsComponent } from '../icons/icons.component';
import { ButtonComponent } from '../inputs/button/button.component';
import { TextInputComponent } from '../inputs/text-input/text-input.component';
import { BookPageOptions, TypeBook } from '../../models/book.models';

@Component({
    selector: 'app-book-filter',
    standalone: true,
    imports: [IconsComponent, ButtonComponent, TextInputComponent],
    templateUrl: './book-filter.component.html',
    styleUrl: './book-filter.component.scss'
})
export class BookFilterComponent {
    @Input() initialFilters?: Partial<BookPageOptions>;
    @Output() filtersChange = new EventEmitter<Partial<BookPageOptions>>();

    // Search
    searchValue = signal<string>('');

    // Type filters
    selectedTypes = signal<TypeBook[]>([]);

    // Tag filters
    selectedTags = signal<string[]>([]);
    tagsLogic = signal<'and' | 'or'>('or');
    excludedTags = signal<string[]>([]);
    excludeTagsLogic = signal<'and' | 'or'>('or');

    // Author filters
    selectedAuthors = signal<string[]>([]);
    authorsLogic = signal<'and' | 'or'>('or');

    // Publication filters
    publicationYear = signal<number | undefined>(undefined);
    publicationOperator = signal<'eq' | 'gt' | 'lt' | 'gte' | 'lte'>('eq');

    // Sorting
    orderBy = signal<'title' | 'createdAt' | 'updatedAt' | 'publication'>('title');
    order = signal<'ASC' | 'DESC'>('ASC');

    // UI state
    showAdvancedFilters = signal<boolean>(false);

    ngOnInit() {
        if (this.initialFilters) {
            this.loadFilters(this.initialFilters);
        }
    }

    private loadFilters(filters: Partial<BookPageOptions>) {
        if (filters.search) this.searchValue.set(filters.search);
        if (filters.type) this.selectedTypes.set(filters.type);
        if (filters.tags) this.selectedTags.set(filters.tags);
        if (filters.tagsLogic) this.tagsLogic.set(filters.tagsLogic);
        if (filters.excludeTags) this.excludedTags.set(filters.excludeTags);
        if (filters.excludeTagsLogic) this.excludeTagsLogic.set(filters.excludeTagsLogic);
        if (filters.authors) this.selectedAuthors.set(filters.authors);
        if (filters.authorsLogic) this.authorsLogic.set(filters.authorsLogic);
        if (filters.publication) this.publicationYear.set(filters.publication);
        if (filters.publicationOperator) this.publicationOperator.set(filters.publicationOperator);
        if (filters.orderBy) this.orderBy.set(filters.orderBy);
        if (filters.order) this.order.set(filters.order);
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

    clearSearch() {
        this.searchValue.set('');
        this.emitFilters();
    }

    clearAllFilters() {
        this.searchValue.set('');
        this.selectedTypes.set([]);
        this.selectedTags.set([]);
        this.excludedTags.set([]);
        this.selectedAuthors.set([]);
        this.publicationYear.set(undefined);
        this.emitFilters();
    }

    toggleAdvancedFilters() {
        this.showAdvancedFilters.set(!this.showAdvancedFilters());
    }

    private emitFilters() {
        const filters: Partial<BookPageOptions> = {};

        if (this.searchValue()) filters.search = this.searchValue();
        if (this.selectedTypes().length > 0) filters.type = this.selectedTypes();
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

        this.filtersChange.emit(filters);
    }

    hasActiveFilters(): boolean {
        return this.searchValue() !== '' ||
            this.selectedTypes().length > 0 ||
            this.selectedTags().length > 0 ||
            this.excludedTags().length > 0 ||
            this.selectedAuthors().length > 0 ||
            this.publicationYear() !== undefined;
    }
}
