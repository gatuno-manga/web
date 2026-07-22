import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { ItemBookComponent } from '@features/books/components/item-book/item-book.component';
import { BookList } from '@models/book.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-book-grid',
	standalone: true,
	imports: [ItemBookComponent, IconsComponent],
	templateUrl: './book-grid.component.html',
	styleUrl: './book-grid.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookGridComponent {
	books = input.required<BookList[]>();
	isLoading = input<boolean>(false);
	type = input<'grid' | 'list' | 'cover'>('grid');
	skeletonCount = input<number>(10);

	skeletons = computed(() => new Array(this.skeletonCount()).fill(0));
}
