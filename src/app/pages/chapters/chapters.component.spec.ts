import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, ReplaySubject } from 'rxjs';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { NotificationService } from '../../service/notification.service';
import { DownloadService } from '../../service/download.service';
import { BookService } from '../../service/book.service';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { ChaptersComponent } from './chapters.component';

describe('ChaptersComponent', () => {
	let component: ChaptersComponent;
	let fixture: ComponentFixture<ChaptersComponent>;
	const findDiagnosticByReason = (
		errorSpy: jasmine.Spy,
		reason: string,
	):
		| {
				reason?: string;
				source?: string;
				origin?: string;
		  }
		| undefined =>
		errorSpy.calls
			.allArgs()
			.flat()
			.find((entry) => {
				if (!entry || typeof entry !== 'object') {
					return false;
				}

				return (entry as { reason?: string }).reason === reason;
			}) as
			| {
					reason?: string;
					source?: string;
					origin?: string;
			  }
			| undefined;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ChaptersComponent, SharedTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(ChaptersComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should show error modal when chapter loading fails', async () => {
		const modalNotificationService = TestBed.inject(
			ModalNotificationService,
		);
		const showSpy = spyOn(modalNotificationService, 'show');
		spyOn<any>(component, 'resolveChapterData').and.rejectWith(
			new Error('boom'),
		);

		await component.loadChapter('chapter-id');

		expect(showSpy).toHaveBeenCalled();

		const [title, description, buttons, type] =
			showSpy.calls.mostRecent().args;
		expect(title).toBe('Erro ao carregar capítulo');
		expect(description).toBe('Erro ao carregar o capítulo.');
		expect(type).toBe('error');
		expect(buttons.length).toBe(2);
		expect(buttons[0].label).toBe('Tentar novamente');
		expect(buttons[1].label).toBe('Voltar');
	});

	it('should show error modal when resolved chapter is null', async () => {
		const modalNotificationService = TestBed.inject(
			ModalNotificationService,
		);
		const showSpy = spyOn(modalNotificationService, 'show');
		spyOn<any>(component, 'resolveChapterData').and.resolveTo(null);

		await component.loadChapter('chapter-id');

		expect(showSpy).toHaveBeenCalled();
	});

	it('should classify 404 failures as not-found in diagnostics', async () => {
		const modalNotificationService = TestBed.inject(
			ModalNotificationService,
		);
		spyOn(modalNotificationService, 'show');
		const errorSpy = spyOn(console, 'error');

		spyOn<any>(component, 'resolveChapterData').and.rejectWith(
			new HttpErrorResponse({ status: 404, statusText: 'Not Found' }),
		);

		await component.loadChapter('chapter-id', false, false, 'route');

		const diagnostic = findDiagnosticByReason(errorSpy, 'not-found');

		expect(diagnostic?.source).toBe('online');
		expect(diagnostic?.origin).toBe('route');
	});

	it('should classify 401 failures as auth in diagnostics', async () => {
		const modalNotificationService = TestBed.inject(
			ModalNotificationService,
		);
		spyOn(modalNotificationService, 'show');
		const errorSpy = spyOn(console, 'error');

		spyOn<any>(component, 'resolveChapterData').and.rejectWith(
			new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }),
		);

		await component.loadChapter('chapter-id', true, false, 'retry-modal');

		const diagnostic = findDiagnosticByReason(errorSpy, 'auth');

		expect(diagnostic?.source).toBe('online');
		expect(diagnostic?.origin).toBe('retry-modal');
	});

	it('should classify null chapter with offline cache as offline-cache-failure', async () => {
		const modalNotificationService = TestBed.inject(
			ModalNotificationService,
		);
		const downloadService = TestBed.inject(DownloadService);
		spyOn(modalNotificationService, 'show');
		const errorSpy = spyOn(console, 'error');
		spyOn(downloadService, 'isChapterDownloaded').and.resolveTo(true);
		spyOn<any>(component, 'resolveChapterData').and.resolveTo(null);

		await component.loadChapter('chapter-id');

		const diagnostic = findDiagnosticByReason(
			errorSpy,
			'offline-cache-failure',
		);

		expect(diagnostic?.source).toBe('offline');
	});

	it('should not reopen the same chapter load error modal while it is active', async () => {
		const modalNotificationService = TestBed.inject(
			ModalNotificationService,
		);
		const showSpy = spyOn(
			modalNotificationService,
			'show',
		).and.callThrough();
		spyOn<any>(component, 'resolveChapterData').and.rejectWith(
			new Error('boom'),
		);

		await component.loadChapter('chapter-id');
		await component.loadChapter('chapter-id');

		expect(showSpy).toHaveBeenCalledTimes(1);
	});

	it('should keep modal closed after manual dismiss until explicit retry', async () => {
		const modalNotificationService = TestBed.inject(
			ModalNotificationService,
		);
		const notificationService = TestBed.inject(NotificationService);
		const showSpy = spyOn(
			modalNotificationService,
			'show',
		).and.callThrough();
		spyOn<any>(component, 'resolveChapterData').and.rejectWith(
			new Error('boom'),
		);

		await component.loadChapter('chapter-id');
		expect(showSpy).toHaveBeenCalledTimes(1);

		notificationService.dismissModal();
		fixture.detectChanges();

		await component.loadChapter('chapter-id');
		expect(showSpy).toHaveBeenCalledTimes(1);
	});

	it('should allow reopening after explicit retry action', async () => {
		const modalNotificationService = TestBed.inject(
			ModalNotificationService,
		);
		const notificationService = TestBed.inject(NotificationService);
		const showSpy = spyOn(
			modalNotificationService,
			'show',
		).and.callThrough();
		spyOn<any>(component, 'resolveChapterData').and.rejectWith(
			new Error('boom'),
		);

		await component.loadChapter('chapter-id');
		expect(showSpy).toHaveBeenCalledTimes(1);

		const buttons = showSpy.calls.mostRecent().args[2] as Array<{
			callback?: () => void;
		}>;

		notificationService.dismissModal();
		buttons[0].callback?.();
		await Promise.resolve();

		expect(showSpy).toHaveBeenCalledTimes(2);
	});

	it('should fetch book data early when bookId is available in params', async () => {
		// Reset testing module to allow fresh configuration for this test
		TestBed.resetTestingModule();

		const paramMap$ = new ReplaySubject(1);
		paramMap$.next(
			convertToParamMap({
				id: 'test-book-id',
				chapter: 'test-chapter-id',
			}),
		);

		const mockActivatedRoute = {
			paramMap: paramMap$,
			snapshot: {
				paramMap: convertToParamMap({
					id: 'test-book-id',
					chapter: 'test-chapter-id',
				}),
			},
		};

		await TestBed.configureTestingModule({
			imports: [ChaptersComponent, SharedTestingModule],
			providers: [{ provide: ActivatedRoute, useValue: mockActivatedRoute }],
		}).compileComponents();

		const bookService = TestBed.inject(BookService);
		const getBookSpy = spyOn(bookService, 'getBook').and.returnValue(
			of({
				blurHash: 'test-hash',
				metadata: { width: 100, height: 200 },
			} as any),
		);

		const newFixture = TestBed.createComponent(ChaptersComponent);
		const newComponent = newFixture.componentInstance;
		newFixture.detectChanges();

		expect(getBookSpy).toHaveBeenCalledWith('test-book-id');
		expect(newComponent.bookBlurHash()).toBe('test-hash');
	});
});




