import {
	ChangeDetectionStrategy,
	Component,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import {
	FormBuilder,
	FormsModule,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { BookInteractionService } from '@core/services/book-interaction.service';
import { NotificationService } from '@core/services/notification.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';

@Component({
	selector: 'app-book-review-form',
	imports: [
		FormsModule,
		ReactiveFormsModule,
		IconsComponent,
		ButtonComponent,
	],
	templateUrl: './book-review-form.component.html',
	styleUrl: './book-review-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookReviewFormComponent {
	private readonly fb = inject(FormBuilder);
	private readonly bookInteractionService = inject(BookInteractionService);
	private readonly notificationService = inject(NotificationService);

	bookId = input.required<string>();
	reviewSubmitted = output<void>();

	reviewForm = this.fb.group({
		rating: [
			0,
			[Validators.required, Validators.min(1), Validators.max(5)],
		],
		content: ['', [Validators.required, Validators.minLength(10)]],
	});

	isSubmitting = signal(false);
	hoverRating = signal(0);

	setRating(rating: number) {
		this.reviewForm.patchValue({ rating });
	}

	setHoverRating(rating: number) {
		this.hoverRating.set(rating);
	}

	submitReview() {
		if (this.reviewForm.invalid) {
			this.notificationService.error(
				'Por favor, preencha todos os campos corretamente (mínimo 10 caracteres).',
			);
			return;
		}

		this.isSubmitting.set(true);
		const data = this.reviewForm.getRawValue() as {
			rating: number;
			content: string;
		};

		this.bookInteractionService.review(this.bookId(), data).subscribe({
			next: () => {
				this.notificationService.success(
					'Sua avaliação foi enviada com sucesso!',
				);
				this.reviewForm.reset({ rating: 0, content: '' });
				this.isSubmitting.set(false);
				this.reviewSubmitted.emit();
			},
			error: (err) => {
				console.error('Erro ao enviar avaliação:', err);
				this.notificationService.error(
					'Ocorreu um erro ao enviar sua avaliação.',
				);
				this.isSubmitting.set(false);
			},
		});
	}
}
