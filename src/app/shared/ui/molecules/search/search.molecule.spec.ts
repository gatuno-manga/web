import {
	ComponentFixture,
	fakeAsync,
	TestBed,
	tick,
} from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { of } from 'rxjs';
import { SearchMoleculeComponent } from './search.molecule';

describe('SearchMoleculeComponent', () => {
	let component: SearchMoleculeComponent;
	let fixture: ComponentFixture<SearchMoleculeComponent>;
	let mockBookService: jasmine.SpyObj<BookService>;
	let mockRouter: jasmine.SpyObj<Router>;
	let mockRoute: any;

	beforeEach(async () => {
		mockBookService = jasmine.createSpyObj('BookService', ['getBooks']);
		mockRouter = jasmine.createSpyObj('Router', ['navigate']);
		mockRoute = {
			snapshot: { queryParams: { type: 'manga' } },
		};

		await TestBed.configureTestingModule({
			imports: [SearchMoleculeComponent, SharedTestingModule],
			providers: [
				{ provide: BookService, useValue: mockBookService },
				{ provide: Router, useValue: mockRouter },
				{ provide: ActivatedRoute, useValue: mockRoute },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(SearchMoleculeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should toggle search expansion', () => {
		expect(component.isSearchExpanded()).toBeFalse();
		component.toggleSearch();
		expect(component.isSearchExpanded()).toBeTrue();
		component.toggleSearch();
		expect(component.isSearchExpanded()).toBeFalse();
	});

	it('should clear search', () => {
		component.isSearchExpanded.set(true);
		component.searchControl.setValue('test');
		component.searchResults.set([{ id: '1', title: 'Test Book' } as any]);
		component.focusedIndex.set(0);

		component.clearSearch();

		expect(component.isSearchExpanded()).toBeFalse();
		expect(component.searchControl.value).toBe('');
		expect(component.searchResults().length).toBe(0);
		expect(component.focusedIndex()).toBe(-1);
	});

	it('should fetch books on search input', fakeAsync(() => {
		mockBookService.getBooks.and.returnValue(
			of({ data: [{ id: '1', title: 'Test Book' } as any] } as any),
		);

		component.searchControl.setValue('test');
		tick(300); // debounce time

		expect(mockBookService.getBooks).toHaveBeenCalledWith({
			search: 'test',
			limit: 5,
		});
		expect(component.searchResults().length).toBe(1);
		expect(component.searchResults()[0].id).toBe('1');
	}));
});
