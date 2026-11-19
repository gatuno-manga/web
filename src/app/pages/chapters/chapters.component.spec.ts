import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { UserTokenService } from '@core/services/auth/user-token.service';
import { ModalNotificationService } from '@core/services/notification/modal-notification.service';
import { NotificationService } from '@core/services/notification/notification.service';
import { BookService } from '@features/books/services/book.service';
import { DownloadService } from '@features/books/services/download.service';
import { ChapterService } from '@features/reading/services/chapter.service';
import { ReadingProgressService } from '@features/reading/services/reading-progress.service';
import { UnifiedReadingProgressService } from '@features/reading/services/unified-reading-progress.service';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { of, ReplaySubject } from 'rxjs';

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
		spyOn(console, 'error');
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
		spyOn(console, 'error');
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
		spyOn(console, 'error');
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
		spyOn(console, 'error');
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
		spyOn(console, 'error');
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
			providers: [
				{ provide: ActivatedRoute, useValue: mockActivatedRoute },
			],
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

	describe('explicit chapter read marking', () => {
		const mockChapter = {
			id: 'ch-1',
			bookId: 'book-1',
			bookTitle: 'Test Book',
			title: 'Chapter 1',
			originalUrl: '',
			index: 1,
			totalChapters: 10,
			contentType: 'image' as const,
			pages: Array.from({ length: 10 }, (_, i) => ({
				index: String(i),
				path: `/p/${i}.jpg`,
			})),
		};

		it('should not mark chapter read on raw open or below 80% progress', async () => {
			const userTokenService = TestBed.inject(UserTokenService);
			const readingProgressService = TestBed.inject(
				UnifiedReadingProgressService,
			);
			spyOn(
				userTokenService,
				'hasValidAccessTokenSignal',
			).and.returnValue(true);
			const markSpy = spyOn(
				readingProgressService,
				'markChapterRead',
			).and.resolveTo();
			spyOn<any>(component, 'resolveChapterData').and.resolveTo(
				mockChapter,
			);
			spyOn<any>(component, 'restoreReadingProgress').and.resolveTo();

			await component.loadChapter('ch-1');
			expect(markSpy).not.toHaveBeenCalled();

			component.onImageProgress({
				pageIndex: 4,
				totalPages: 10,
				scrollPercentage: 50,
			});
			expect(markSpy).not.toHaveBeenCalled();
		});

		it('should mark chapter read once when reaching >= 80% progress for signed-in users', async () => {
			const userTokenService = TestBed.inject(UserTokenService);
			const readingProgressService = TestBed.inject(
				UnifiedReadingProgressService,
			);
			spyOn(
				userTokenService,
				'hasValidAccessTokenSignal',
			).and.returnValue(true);
			const markSpy = spyOn(
				readingProgressService,
				'markChapterRead',
			).and.resolveTo();
			spyOn<any>(component, 'resolveChapterData').and.resolveTo(
				mockChapter,
			);
			spyOn<any>(component, 'restoreReadingProgress').and.resolveTo();

			await component.loadChapter('ch-1');

			component.onImageProgress({
				pageIndex: 7,
				totalPages: 10,
				scrollPercentage: 80,
			});
			component.onImageProgress({
				pageIndex: 8,
				totalPages: 10,
				scrollPercentage: 90,
			});

			expect(markSpy).toHaveBeenCalledTimes(1);
			expect(markSpy).toHaveBeenCalledWith('ch-1');
		});

		it('should mark chapter read on markChapterAsCompleted even for text chapters below 80%', async () => {
			const userTokenService = TestBed.inject(UserTokenService);
			const readingProgressService = TestBed.inject(
				UnifiedReadingProgressService,
			);
			spyOn(
				userTokenService,
				'hasValidAccessTokenSignal',
			).and.returnValue(true);
			const markSpy = spyOn(
				readingProgressService,
				'markChapterRead',
			).and.resolveTo();
			spyOn(
				readingProgressService,
				'saveProgressImmediate',
			).and.resolveTo();
			spyOn<any>(component, 'resolveChapterData').and.resolveTo({
				...mockChapter,
				id: 'ch-text',
				contentType: 'text',
				pages: [],
			});
			spyOn<any>(component, 'restoreReadingProgress').and.resolveTo();

			await component.loadChapter('ch-text');
			await (component as any).markChapterAsCompleted();

			expect(markSpy).toHaveBeenCalledTimes(1);
			expect(markSpy).toHaveBeenCalledWith('ch-text');
		});

		it('should not mark chapter read for guest / anonymous users', async () => {
			const userTokenService = TestBed.inject(UserTokenService);
			const chapterService = TestBed.inject(ChapterService);
			const localProgressService = TestBed.inject(ReadingProgressService);
			spyOnProperty(
				userTokenService,
				'hasValidAccessToken',
				'get',
			).and.returnValue(false);
			spyOnProperty(
				userTokenService,
				'hasValidRefreshToken',
				'get',
			).and.returnValue(false);
			const httpSpy = spyOn(chapterService, 'markAsRead');
			const enqueueSpy = spyOn(
				localProgressService,
				'enqueuePendingReadMark',
			);
			spyOn<any>(component, 'resolveChapterData').and.resolveTo(
				mockChapter,
			);
			spyOn<any>(component, 'restoreReadingProgress').and.resolveTo();

			await component.loadChapter('ch-1');
			component.onImageProgress({
				pageIndex: 9,
				totalPages: 10,
				scrollPercentage: 100,
			});
			await (component as any).markChapterAsCompleted();

			expect(httpSpy).not.toHaveBeenCalled();
			expect(enqueueSpy).not.toHaveBeenCalled();
		});

		it('should NOT mark document chapter read on raw open before PDF loads, and SHOULD mark read at >= 80% after load', async () => {
			const readingProgressService = TestBed.inject(
				UnifiedReadingProgressService,
			);
			const markSpy = spyOn(
				readingProgressService,
				'markChapterRead',
			).and.resolveTo();
			spyOn<any>(component, 'resolveChapterData').and.resolveTo({
				...mockChapter,
				id: 'ch-doc',
				contentType: 'document',
				pages: [],
				documentPath: 'https://example.com/doc.pdf',
			});
			spyOn<any>(component, 'restoreReadingProgress').and.resolveTo();

			await component.loadChapter('ch-doc');
			expect(markSpy).not.toHaveBeenCalled();

			component.onDocumentProgress({
				pageIndex: 7,
				totalPages: 10,
			});
			expect(markSpy).toHaveBeenCalledTimes(1);
			expect(markSpy).toHaveBeenCalledWith('ch-doc');
		});

		it('should NOT mark chapter read when totalPages is 0', async () => {
			const readingProgressService = TestBed.inject(
				UnifiedReadingProgressService,
			);
			const markSpy = spyOn(
				readingProgressService,
				'markChapterRead',
			).and.resolveTo();
			spyOn<any>(component, 'resolveChapterData').and.resolveTo(
				mockChapter,
			);
			spyOn<any>(component, 'restoreReadingProgress').and.resolveTo();

			await component.loadChapter('ch-1');

			component.onImageProgress({ pageIndex: 0, totalPages: 0 });
			component.onDocumentProgress({
				pageIndex: 0,
				totalPages: 0,
			});

			expect(markSpy).not.toHaveBeenCalled();
		});

		it('should only mark chapter read on chapter transition when direction is next, not previous', async () => {
			const userTokenService = TestBed.inject(UserTokenService);
			const readingProgressService = TestBed.inject(
				UnifiedReadingProgressService,
			);
			const downloadService = TestBed.inject(DownloadService);
			spyOn(
				userTokenService,
				'hasValidAccessTokenSignal',
			).and.returnValue(true);
			const markSpy = spyOn(
				readingProgressService,
				'markChapterRead',
			).and.resolveTo();
			spyOn(
				readingProgressService,
				'saveProgressImmediate',
			).and.resolveTo();
			spyOn(downloadService, 'isChapterDownloaded').and.resolveTo(true);
			spyOn<any>(component, 'navigateToChapter');
			spyOn<any>(component, 'resolveChapterData').and.resolveTo({
				...mockChapter,
				previous: 'ch-0',
				next: 'ch-2',
			});
			spyOn<any>(component, 'restoreReadingProgress').and.resolveTo();

			await component.loadChapter('ch-1');

			await component.previousPage();
			expect(markSpy).not.toHaveBeenCalled();

			await component.nextPage();
			expect(markSpy).toHaveBeenCalledTimes(1);
			expect(markSpy).toHaveBeenCalledWith('ch-1');
		});

		it('should mark offline-downloaded chapter read when reaching >= 80%', async () => {
			const userTokenService = TestBed.inject(UserTokenService);
			const readingProgressService = TestBed.inject(
				UnifiedReadingProgressService,
			);
			const downloadService = TestBed.inject(DownloadService);
			spyOn(
				userTokenService,
				'hasValidAccessTokenSignal',
			).and.returnValue(true);
			const markSpy = spyOn(
				readingProgressService,
				'markChapterRead',
			).and.resolveTo();
			spyOn(downloadService, 'isChapterDownloaded').and.resolveTo(true);
			spyOn(downloadService, 'getChapter').and.resolveTo({
				id: 'ch-offline',
				bookId: 'book-1',
				index: 1,
				title: 'Offline Chapter',
				contentType: 'image',
				pages: new Array(10)
					.fill(null)
					.map(() => new Blob(['img'], { type: 'image/png' })),
			} as any);
			spyOn(downloadService, 'getBook').and.resolveTo(undefined);
			spyOn<any>(component, 'restoreReadingProgress').and.resolveTo();

			await component.loadChapter('ch-offline');
			component.onImageProgress({ pageIndex: 8, totalPages: 10 });

			expect(markSpy).toHaveBeenCalledTimes(1);
			expect(markSpy).toHaveBeenCalledWith('ch-offline');
		});
	});
});
