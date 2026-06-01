import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DownloadService } from '@core/services/download.service';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { of } from 'rxjs';

import { ItemBookComponent } from './item-book.component';

describe('ItemBookComponent', () => {
	let component: ItemBookComponent;
	let fixture: ComponentFixture<ItemBookComponent>;
	let downloadService: jasmine.SpyObj<DownloadService>;

	beforeEach(async () => {
		const downloadSpy = jasmine.createSpyObj('DownloadService', [
			'isBookDownloaded',
			'getBookDownloadProgress',
			'deleteBook',
			'downloadChapter',
			'isChapterDownloaded',
			'syncBook',
		]);
		downloadSpy.isBookDownloaded.and.returnValue(Promise.resolve(false));
		downloadSpy.getBookDownloadProgress.and.returnValue(of([]));

		await TestBed.configureTestingModule({
			imports: [ItemBookComponent, SharedTestingModule],
			providers: [{ provide: DownloadService, useValue: downloadSpy }],
		}).compileComponents();

		downloadService = TestBed.inject(
			DownloadService,
		) as jasmine.SpyObj<DownloadService>;
		fixture = TestBed.createComponent(ItemBookComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('book', {
			id: 'b1',
			title: 'Test',
			authors: [],
			covers: [],
			cover: 'test-cover.jpg',
			totalChapters: 10,
		} as any);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should show offline badge when isOffline is true', async () => {
		component.isOffline.set(true);
		fixture.detectChanges();
		const badge = fixture.nativeElement.querySelector('.offline-badge');
		expect(badge).toBeTruthy();
		expect(badge.getAttribute('title')).toBe('Disponível Offline');
	});

	it('should show download progress when downloading', () => {
		component.downloadProgress.set(45);
		fixture.detectChanges();
		const badge = fixture.nativeElement.querySelector('.downloading-badge');
		expect(badge).toBeTruthy();
		expect(badge.getAttribute('title')).toBe('Baixando: 45%');
	});

	it('should accept type input and default to grid', () => {
		expect(component.type()).toBe('grid');
		fixture.componentRef.setInput('type', 'list');
		fixture.detectChanges();
		expect(component.type()).toBe('list');
	});

	it('should truncate titles longer than 80 characters', () => {
		const longTitle =
			'This is a very long title that definitely exceeds eighty characters to test if the truncation logic works correctly';
		fixture.componentRef.setInput('book', {
			...component.book(),
			title: longTitle,
		});
		fixture.detectChanges();
		expect(component.truncatedTitle()).toBe(
			`${longTitle.substring(0, 80)}...`,
		);
	});

	it('should handle null or undefined properties in the book object without crashing', () => {
		fixture.componentRef.setInput('book', {
			id: 'b2',
			title: null,
			description: undefined,
		} as any);
		fixture.detectChanges();
		expect(component.truncatedTitle()).toBe('');
		expect(component.truncatedDescription()).toBe('');
		expect(component.isBlobUrl(null)).toBe(false);
	});

	it('should call bookService.fixAllCovers when fixCovers is triggered', () => {
		const bookService = (component as any).bookService;
		const modalService = (component as any).modalService;

		spyOn(bookService, 'fixAllCovers').and.returnValue({
			subscribe: (cb: any) => cb.next(),
		} as any);
		spyOn(modalService, 'show').and.callFake(
			(_title: string, _msg: string, buttons: any[]) => {
				// Find the "Corrigir" button and execute its callback
				const fixButton = buttons.find((b) => b.label === 'Corrigir');
				if (fixButton?.callback) {
					fixButton.callback();
				}
			},
		);

		component.fixCovers();

		expect(bookService.fixAllCovers).toHaveBeenCalledWith('b1');
	});
});
