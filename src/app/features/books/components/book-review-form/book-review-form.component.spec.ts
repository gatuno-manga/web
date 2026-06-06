import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { BookInteractionService } from '@core/services/book-interaction.service';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { of } from 'rxjs';
import { BookReviewFormComponent } from './book-review-form.component';

describe('BookReviewFormComponent', () => {
	let component: BookReviewFormComponent;
	let fixture: ComponentFixture<BookReviewFormComponent>;
	let interactionService: jasmine.SpyObj<BookInteractionService>;

	beforeEach(async () => {
		const spy = jasmine.createSpyObj('BookInteractionService', ['review']);

		await TestBed.configureTestingModule({
			imports: [
				BookReviewFormComponent,
				SharedTestingModule,
				ReactiveFormsModule,
			],
			providers: [{ provide: BookInteractionService, useValue: spy }],
		}).compileComponents();

		interactionService = TestBed.inject(
			BookInteractionService,
		) as jasmine.SpyObj<BookInteractionService>;

		fixture = TestBed.createComponent(BookReviewFormComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('bookId', 'test-book-id');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should update rating', () => {
		component.setRating(4);
		expect(component.reviewForm.get('rating')?.value).toBe(4);
	});

	it('should call review service on submit', () => {
		interactionService.review.and.returnValue(of(undefined));
		component.reviewForm.patchValue({
			rating: 5,
			content: 'Excellent book!',
		});

		component.submitReview();

		expect(interactionService.review).toHaveBeenCalledWith('test-book-id', {
			rating: 5,
			content: 'Excellent book!',
		});
	});
});
