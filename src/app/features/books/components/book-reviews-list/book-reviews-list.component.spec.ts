import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookInteractionService } from '@core/services/book-interaction.service';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { of } from 'rxjs';
import { BookReviewsListComponent } from './book-reviews-list.component';

describe('BookReviewsListComponent', () => {
	let component: BookReviewsListComponent;
	let fixture: ComponentFixture<BookReviewsListComponent>;
	let interactionService: jasmine.SpyObj<BookInteractionService>;

	beforeEach(async () => {
		const spy = jasmine.createSpyObj('BookInteractionService', [
			'getReviews',
		]);

		await TestBed.configureTestingModule({
			imports: [BookReviewsListComponent, SharedTestingModule],
			providers: [{ provide: BookInteractionService, useValue: spy }],
		}).compileComponents();

		interactionService = TestBed.inject(
			BookInteractionService,
		) as jasmine.SpyObj<BookInteractionService>;
		interactionService.getReviews.and.returnValue(of([]));

		fixture = TestBed.createComponent(BookReviewsListComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('bookId', 'test-book-id');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should load reviews on init', () => {
		expect(interactionService.getReviews).toHaveBeenCalledWith(
			'test-book-id',
		);
	});

	it('should render empty state when no reviews', () => {
		const compiled = fixture.nativeElement as HTMLElement;
		expect(compiled.querySelector('.empty-state')).toBeTruthy();
	});
});
