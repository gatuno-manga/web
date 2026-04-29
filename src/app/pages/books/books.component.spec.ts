import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { BooksComponent } from './books.component';
import { BookService } from '../../service/book.service';
import { SensitiveContentService } from '../../service/sensitive-content.service';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

describe('BooksComponent', () => {
	let component: BooksComponent;
	let fixture: ComponentFixture<BooksComponent>;
	let bookService: jasmine.SpyObj<BookService>;
	let sensitiveContentService: jasmine.SpyObj<SensitiveContentService>;

	beforeEach(async () => {
		const bookServiceSpy = jasmine.createSpyObj('BookService', [
			'getBooksGraphQL',
		]);
		const sensitiveServiceSpy = jasmine.createSpyObj(
			'SensitiveContentService',
			['getContentAllow'],
		);

		await TestBed.configureTestingModule({
			imports: [BooksComponent, SharedTestingModule],
			providers: [
				{ provide: BookService, useValue: bookServiceSpy },
				{
					provide: SensitiveContentService,
					useValue: sensitiveServiceSpy,
				},
				{
					provide: ActivatedRoute,
					useValue: {
						queryParams: of({}),
						snapshot: { queryParams: {} },
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(BooksComponent);
		component = fixture.componentInstance;
		bookService = TestBed.inject(BookService) as jasmine.SpyObj<BookService>;
		sensitiveContentService = TestBed.inject(
			SensitiveContentService,
		) as jasmine.SpyObj<SensitiveContentService>;

		sensitiveContentService.getContentAllow.and.returnValue([]);
		bookService.getBooksGraphQL.and.returnValue(
			of({
				data: [],
				page: 1,
				lastPage: 1,
			}),
		);
	});

	it('should create', () => {
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	it('should use fallback sensitive content when no query params are provided', () => {
		sensitiveContentService.getContentAllow.and.returnValue(['explicit']);

		fixture.detectChanges(); // Trigger ngOnInit

		expect(bookService.getBooksGraphQL).toHaveBeenCalledWith(
			jasmine.objectContaining({
				sensitiveContent: ['safe', 'explicit'],
			}),
			jasmine.any(Array),
		);
	});

	it('should only include "safe" when no sensitive content is allowed', () => {
		sensitiveContentService.getContentAllow.and.returnValue([]);

		fixture.detectChanges(); // Trigger ngOnInit

		expect(bookService.getBooksGraphQL).toHaveBeenCalledWith(
			jasmine.objectContaining({
				sensitiveContent: ['safe'],
			}),
			jasmine.any(Array),
		);
	});
});
