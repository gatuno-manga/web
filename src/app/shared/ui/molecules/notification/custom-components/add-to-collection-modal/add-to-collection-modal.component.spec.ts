import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionService } from '@core/services/collection.service';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { of } from 'rxjs';
import { AddToCollectionModalComponent } from './add-to-collection-modal.component';

describe('AddToCollectionModalComponent', () => {
	let component: AddToCollectionModalComponent;
	let fixture: ComponentFixture<AddToCollectionModalComponent>;
	let collectionService: jasmine.SpyObj<CollectionService>;

	beforeEach(async () => {
		const spy = jasmine.createSpyObj(
			'CollectionService',
			['getMyCollections', 'addBookToCollection'],
			{
				myCollections: () => [],
			},
		);

		await TestBed.configureTestingModule({
			imports: [AddToCollectionModalComponent, SharedTestingModule],
			providers: [{ provide: CollectionService, useValue: spy }],
		}).compileComponents();

		collectionService = TestBed.inject(
			CollectionService,
		) as jasmine.SpyObj<CollectionService>;
		collectionService.getMyCollections.and.returnValue(of([]));

		fixture = TestBed.createComponent(AddToCollectionModalComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('bookId', 'test-id');
		fixture.componentRef.setInput('bookTitle', 'Test Book');
		fixture.componentRef.setInput('close', () => {});
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should load collections on init', () => {
		expect(collectionService.getMyCollections).toHaveBeenCalled();
	});

	it('should add book to collection and call close', () => {
		const closeSpy = jasmine.createSpy('close');
		fixture.componentRef.setInput('close', closeSpy);
		collectionService.addBookToCollection.and.returnValue(of(undefined));

		component.addToCollection('col-id');

		expect(collectionService.addBookToCollection).toHaveBeenCalledWith(
			'col-id',
			{ bookId: 'test-id' },
		);
		expect(closeSpy).toHaveBeenCalledWith(true);
	});
});
