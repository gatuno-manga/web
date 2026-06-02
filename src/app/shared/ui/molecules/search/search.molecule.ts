import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	inject,
	signal,
	viewChild,
	viewChildren,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { BookList } from '@models/book.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import {
	debounceTime,
	distinctUntilChanged,
	filter,
	switchMap,
	tap,
} from 'rxjs';

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
	private router = inject(Router);
	private route = inject(ActivatedRoute);

	isSearchExpanded = signal(false);
	searchControl = new FormControl('', { nonNullable: true });
	searchResults = signal<BookList[]>([]);
	isSearching = signal(false);

	/** Índice do item de resultado com foco no teclado (-1 = input) */
	focusedIndex = signal(-1);

	searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
	searchBtn = viewChild<ElementRef<HTMLButtonElement>>('searchBtn');
	resultItems = viewChildren<ElementRef<HTMLAnchorElement>>('resultItem');

	constructor() {
		this.searchControl.valueChanges
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				tap((term) => {
					if (!term) {
						this.searchResults.set([]);
						this.focusedIndex.set(-1);
					}
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
				this.focusedIndex.set(-1);
			});
	}

	toggleSearch() {
		const wasExpanded = this.isSearchExpanded();
		this.isSearchExpanded.update((v) => !v);

		if (!wasExpanded) {
			// Abrindo: foca o input após a animação CSS iniciar
			setTimeout(() => this.searchInput()?.nativeElement.focus(), 50);
		} else {
			this.clearSearch();
		}
	}

	clearSearch() {
		this.isSearchExpanded.set(false);
		this.searchControl.setValue('');
		this.searchResults.set([]);
		this.focusedIndex.set(-1);
	}

	/**
	 * Blur do input: só fecha se o foco foi para fora de todo o componente.
	 * Usar relatedTarget evita fechar ao clicar no botão ícone ou nos resultados.
	 */
	onSearchBlur(event: FocusEvent) {
		const relatedTarget = event.relatedTarget as HTMLElement | null;

		// Se o foco foi para um filho do componente (botão, link de resultado), não fecha
		const host = (this.searchInput()?.nativeElement.closest('app-search') ??
			this.searchInput()?.nativeElement.parentElement
				?.parentElement) as HTMLElement | null;

		if (host && relatedTarget && host.contains(relatedTarget)) {
			return;
		}

		this.clearSearch();
	}

	/** Impede o blur do input ao clicar dentro do dropdown */
	preventBlur(event: MouseEvent) {
		event.preventDefault();
	}

	/**
	 * Navegação por teclado:
	 * - ArrowDown: desce nos resultados
	 * - ArrowUp: sobe nos resultados (volta ao input no topo)
	 * - Enter: navega para a página de busca (ou para o livro focado)
	 * - Escape: fecha o search
	 */
	onKeydown(event: KeyboardEvent) {
		const results = this.searchResults();
		const total = results.length;

		switch (event.key) {
			case 'ArrowDown': {
				event.preventDefault();
				if (total === 0) return;
				const next = Math.min(this.focusedIndex() + 1, total - 1);
				this.focusedIndex.set(next);
				this.focusResult(next);
				break;
			}

			case 'ArrowUp': {
				event.preventDefault();
				if (this.focusedIndex() <= 0) {
					this.focusedIndex.set(-1);
					this.searchInput()?.nativeElement.focus();
				} else {
					const prev = this.focusedIndex() - 1;
					this.focusedIndex.set(prev);
					this.focusResult(prev);
				}
				break;
			}

			case 'Enter': {
				event.preventDefault();
				const focused = this.focusedIndex();
				if (focused >= 0 && results[focused]) {
					// Navega para o livro em foco
					this.router.navigate(['/books', results[focused].id]);
					this.clearSearch();
				} else {
					// Navega para a página de busca preservando filtros ativos
					this.navigateToSearch();
				}
				break;
			}

			case 'Escape': {
				event.preventDefault();
				this.clearSearch();
				this.searchBtn()?.nativeElement.focus();
				break;
			}
		}
	}

	/** Navega para /books com o termo de busca, preservando filtros ativos */
	private navigateToSearch() {
		const term = this.searchControl.value.trim();
		if (!term) return;

		// Mantém filtros já ativos na URL (ex: type, tags, etc.) e sobrescreve search
		const currentParams = { ...this.route.snapshot.queryParams };
		this.router.navigate(['/books'], {
			queryParams: { ...currentParams, search: term, page: 1 },
		});
		this.clearSearch();
	}

	private focusResult(index: number) {
		const items = this.resultItems();
		items[index]?.nativeElement.focus();
	}
}
