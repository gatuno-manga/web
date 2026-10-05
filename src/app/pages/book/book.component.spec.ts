import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetaDataService } from '@core/services/meta-data.service';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { BookComponent } from './book.component';

describe('BookComponent', () => {
	let component: BookComponent;
	let fixture: ComponentFixture<BookComponent>;
	let metaService: MetaDataService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BookComponent, SharedTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(BookComponent);
		component = fixture.componentInstance;
		metaService = TestBed.inject(MetaDataService);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should set metadata with dynamic canonical URL and never use example.com', () => {
		const metaSpy = spyOn(metaService, 'setMetaData');
		component.book.set({
			id: 'book-123',
			title: 'Aventura Gatuna',
			description: 'Uma jornada felina',
			cover: 'cover.jpg',
		} as any);

		component.setMetaData();

		expect(metaSpy).toHaveBeenCalled();
		const callArgs = metaSpy.calls.mostRecent().args[0];
		expect(callArgs.title).toBe('Aventura Gatuna');
		expect(callArgs.description).toBe('Uma jornada felina');
		expect(callArgs.url).toContain('/books/book-123');
		expect(callArgs.url).not.toContain('example.com');
	});
});
