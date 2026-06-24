import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookInteractionService } from '@core/services/book-interaction.service';
import { CollectionService } from '@core/services/collection.service';
import { of } from 'rxjs';
import { LibraryComponent } from './library.component';

describe('LibraryComponent', () => {
	let component: LibraryComponent;
	let fixture: ComponentFixture<LibraryComponent>;

	const mockCollectionService = {
		getMyCollections: jasmine
			.createSpy('getMyCollections')
			.and.returnValue(of([])),
	};

	const mockBookInteractionService = {
		getFavorites: jasmine
			.createSpy('getFavorites')
			.and.returnValue(of({ data: [] })),
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [LibraryComponent],
			providers: [
				{ provide: CollectionService, useValue: mockCollectionService },
				{
					provide: BookInteractionService,
					useValue: mockBookInteractionService,
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(LibraryComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
