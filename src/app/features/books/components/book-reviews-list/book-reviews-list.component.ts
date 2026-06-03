import { DatePipe, NgOptimizedImage } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	input,
	OnInit,
	signal,
} from '@angular/core';
import { BookInteractionService } from '@core/services/book-interaction.service';
import { BookReview } from '@models/book-interaction.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-book-reviews-list',
	imports: [IconsComponent, DatePipe, NgOptimizedImage],
	templateUrl: './book-reviews-list.component.html',
	styleUrl: './book-reviews-list.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookReviewsListComponent implements OnInit {
	private readonly interactionService = inject(BookInteractionService);

	bookId = input.required<string>();
	reviews = signal<BookReview[]>([]);
	isLoading = signal(true);

	ngOnInit() {
		this.loadReviews();
	}

	loadReviews() {
		this.isLoading.set(true);
		this.interactionService.getReviews(this.bookId()).subscribe({
			next: (reviews) => {
				this.reviews.set(reviews);
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Error loading reviews:', err);
				this.isLoading.set(false);
			},
		});
	}

	getStars(_rating: number): number[] {
		return Array(5)
			.fill(0)
			.map((_, i) => i + 1);
	}
}
