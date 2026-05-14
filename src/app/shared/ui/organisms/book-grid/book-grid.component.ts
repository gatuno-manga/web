import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ItemBookComponent } from '@features/books/components/item-book/item-book.component';
import { BookList } from '@models/book.models';

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
