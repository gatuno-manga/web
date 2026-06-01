import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { ThemeService } from '@core/services/theme.service';
import { BookList } from '@models/book.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs';

@Component({
	selector: 'app-search',
	standalone: true,
	imports: [RouterModule, IconsComponent, ReactiveFormsModule],
	templateUrl: './search.molecule.html',
	styleUrl: './search.molecule.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchMoleculeComponent {
	private bookService = inject(BookService);
	private themeService = inject(ThemeService);

	isSearchExpanded = signal(false);
	searchControl = new FormControl('', { nonNullable: true });
	searchResults = signal<BookList[]>([]);
	isSearching = signal(false);
	searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

	constructor() {
		this.searchControl.valueChanges
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				tap((term) => {
					if (!term) this.searchResults.set([]);
				}),
				filter((term) => term.length >= 2),
				tap(() => this.isSearching.set(true)),
				switchMap((term) =>
					this.bookService.getBooks({ search: term, limit: 5 }),
				),
				tap(() => this.isSearching.set(false)),
			)
			.subscribe((response) => {
				this.searchResults.set(response.data);
			});
	}

	toggleSearch() {
		this.isSearchExpanded.update((v) => !v);
		if (this.isSearchExpanded()) {
			setTimeout(() => this.searchInput()?.nativeElement.focus(), 100);
		} else {
			this.clearSearch();
		}
	}

	clearSearch() {
		this.isSearchExpanded.set(false);
		this.searchControl.setValue('');
		this.searchResults.set([]);
	}

	onSearchBlur() {
		// Use a small delay to allow clicking on dropdown results
		setTimeout(() => {
			this.clearSearch();
		}, 200);
	}

	preventBlur(event: MouseEvent) {
		event.preventDefault();
	}

	isDarkTheme = computed(() =>
		['dark', 'true-dark'].includes(this.themeService.currentTheme()),
	);
}
