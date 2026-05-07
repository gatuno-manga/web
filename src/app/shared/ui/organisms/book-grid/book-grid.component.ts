import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookList } from '@models/book.models';
import { ItemBookComponent } from '@features/books/components/item-book/item-book.component';

@Component({
	selector: 'app-book-grid',
	standalone: true,
	imports: [CommonModule, ItemBookComponent],
	templateUrl: './book-grid.component.html',
	styleUrl: './book-grid.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookGridComponent {
	books = input.required<BookList[]>();
	isLoading = input<boolean>(false);
	type = input<'grid' | 'list' | 'cover'>('grid');
	skeletonCount = input<number>(10);
}
