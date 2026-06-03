import { NgOptimizedImage } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	input,
	OnInit,
	output,
	signal,
} from '@angular/core';
import {
	FormBuilder,
	FormsModule,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { BookService } from '@core/services/book.service';
import { BookRelationshipService } from '@core/services/book-relationship.service';
import { NotificationService } from '@core/services/notification.service';
import { BookList } from '@models/book.models';
import {
	CreateBookRelationshipDto,
	RelationType,
} from '@models/book-relationship.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import {
	catchError,
	debounceTime,
	distinctUntilChanged,
	of,
	Subject,
	switchMap,
} from 'rxjs';

@Component({
	selector: 'app-add-related-book-modal',
	imports: [
		FormsModule,
		ReactiveFormsModule,
		IconsComponent,
		ButtonComponent,
		NgOptimizedImage,
	],
	templateUrl: './add-related-book-modal.component.html',
	styleUrl: './add-related-book-modal.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddRelatedBookModalComponent implements OnInit {
	private readonly fb = inject(FormBuilder);
	private readonly relationshipService = inject(BookRelationshipService);
	private readonly bookService = inject(BookService);
	private readonly notificationService = inject(NotificationService);

	sourceBookId = input.required<string>();
	close = output<boolean>();

	form = this.fb.group({
		targetBookId: ['', Validators.required],
		relationType: ['sequence' as RelationType, Validators.required],
		isBidirectional: [true],
	});

	relationTypes: { value: RelationType; label: string }[] = [
		{ value: 'sequence', label: 'Sequência' },
		{ value: 'spin-off', label: 'Spin-off' },
		{ value: 'doujinshi', label: 'Doujinshi' },
		{ value: 'same-franchise', label: 'Mesma Franquia' },
		{ value: 'related', label: 'Relacionado' },
		{ value: 'adaptation', label: 'Adaptação' },
		{ value: 'crossover', label: 'Crossover' },
	];

	searchQuery = new Subject<string>();
	searchResults = signal<BookList[]>([]);
	isSearching = signal(false);
	selectedBook = signal<BookList | null>(null);
	isSubmitting = signal(false);

	ngOnInit() {
		this.searchQuery
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				switchMap((query) => {
					if (query.trim().length < 3) return of({ data: [] });
					this.isSearching.set(true);
					return this.bookService
						.getBooks({ search: query, limit: 10 })
						.pipe(
							catchError((err) => {
								console.error('Error searching books:', err);
								return of({ data: [] });
							}),
						);
				}),
			)
			.subscribe({
				next: (res) => {
					// Filtrar o próprio livro da lista de resultados
					const filtered = res.data.filter(
						(b) => b.id !== this.sourceBookId(),
					);
					this.searchResults.set(filtered);
					this.isSearching.set(false);
				},
			});
	}

	onSearchChange(event: Event) {
		const query = (event.target as HTMLInputElement).value;
		this.searchQuery.next(query);
	}

	selectBook(book: BookList) {
		this.selectedBook.set(book);
		this.form.patchValue({ targetBookId: book.id });
		this.searchResults.set([]);
	}

	clearSelection() {
		this.selectedBook.set(null);
		this.form.patchValue({ targetBookId: '' });
	}

	onClose() {
		this.close.emit(false);
	}

	submit() {
		if (this.form.invalid) return;

		this.isSubmitting.set(true);
		const data = this.form.getRawValue() as CreateBookRelationshipDto;

		this.relationshipService
			.createRelationship(this.sourceBookId(), data)
			.subscribe({
				next: () => {
					this.notificationService.success(
						'Relacionamento adicionado com sucesso!',
					);
					this.isSubmitting.set(false);
					this.close.emit(true);
				},
				error: (err) => {
					console.error('Erro ao adicionar relacionamento:', err);
					this.notificationService.error(
						'Ocorreu um erro ao adicionar o relacionamento.',
					);
					this.isSubmitting.set(false);
				},
			});
	}
}
