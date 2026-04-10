import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { NotificationService } from '../../service/notification.service';

import { ChaptersComponent } from './chapters.component';

describe('ChaptersComponent', () => {
	let component: ChaptersComponent;
	let fixture: ComponentFixture<ChaptersComponent>;

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
});
