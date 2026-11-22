import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetaDataService } from '@core/services/browser/meta-data.service';
import { ENVIRONMENT } from '@core/tokens/environment.token';
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

describe('BookComponent setMetaData publicURL resolution', () => {
	async function setup(publicURL: string, platformId: string) {
		await TestBed.configureTestingModule({
			imports: [BookComponent, SharedTestingModule],
			providers: [
				{ provide: ENVIRONMENT, useValue: { publicURL } },
				{ provide: PLATFORM_ID, useValue: platformId },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(BookComponent);
		const component = fixture.componentInstance;
		const metaService = TestBed.inject(MetaDataService);
		fixture.detectChanges();
		return { component, metaService };
	}

	it('should use configured publicURL and strip trailing slashes', async () => {
		const { component, metaService } = await setup(
			'https://gatuno.app///',
			'server',
		);
		const metaSpy = spyOn(metaService, 'setMetaData');
		component.book.set({
			id: 'book-123',
			title: 'Aventura Gatuna',
			description: 'Uma jornada felina',
			cover: 'cover.jpg',
		} as any);

		component.setMetaData();

		expect(metaSpy).toHaveBeenCalledWith(
			jasmine.objectContaining({
				url: 'https://gatuno.app/books/book-123',
			}),
		);
	});

	it('should fall back to window.location.origin in browser when publicURL is empty', async () => {
		const { component, metaService } = await setup('', 'browser');
		const metaSpy = spyOn(metaService, 'setMetaData');
		component.book.set({
			id: 'book-123',
			title: 'Aventura Gatuna',
			description: 'Uma jornada felina',
			cover: 'cover.jpg',
		} as any);

		component.setMetaData();

		expect(metaSpy).toHaveBeenCalledWith(
			jasmine.objectContaining({
				url: `${window.location.origin}/books/book-123`,
			}),
		);
	});

	it('should fall back to relative /books/:id path in SSR when publicURL is empty', async () => {
		const { component, metaService } = await setup('   ', 'server');
		const metaSpy = spyOn(metaService, 'setMetaData');
		component.book.set({
			id: 'book-123',
			title: 'Aventura Gatuna',
			description: 'Uma jornada felina',
			cover: 'cover.jpg',
		} as any);

		component.setMetaData();

		expect(metaSpy).toHaveBeenCalledWith(
			jasmine.objectContaining({
				url: '/books/book-123',
			}),
		);
	});
});
