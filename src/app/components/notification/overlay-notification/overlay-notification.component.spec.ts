import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NotificationService } from '@service/notification.service';
import { NotificationSeverity } from '@service/notification/notification-strategy.interface';

import { OverlayNotificationComponent } from './overlay-notification.component';

describe('OverlayNotificationComponent', () => {
	let component: OverlayNotificationComponent;
	let fixture: ComponentFixture<OverlayNotificationComponent>;
	let notificationService: NotificationService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OverlayNotificationComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(OverlayNotificationComponent);
		component = fixture.componentInstance;
		notificationService = TestBed.inject(NotificationService);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should close modal and execute callback when action button is clicked', () => {
		const callback = jasmine.createSpy('callback');

		notificationService.notify({
			message: 'Tem certeza que deseja continuar?',
			level: 'warning',
			severity: NotificationSeverity.CRITICAL,
			title: 'Confirmação',
			buttons: [{ label: 'Continuar', type: 'primary', callback }],
		});
		fixture.detectChanges();

		const actionButton = fixture.debugElement.query(
			By.css('.modal-footer button'),
		);
		actionButton.triggerEventHandler('click', null);
		fixture.detectChanges();

		expect(callback).toHaveBeenCalled();
		expect(notificationService.modal()).toBeNull();
	});

	it('should close modal when close button X is clicked', () => {
		notificationService.showModal('Falha ao carregar', 'error', 'Erro');
		fixture.detectChanges();

		const closeButton = fixture.debugElement.query(
			By.css('.close-modal-btn'),
		);
		closeButton.triggerEventHandler('click', null);
		fixture.detectChanges();

		expect(notificationService.modal()).toBeNull();
	});

	it('should allow callback to open a new modal after dismissing current one', () => {
		notificationService.notify({
			message: 'Primeiro modal',
			level: 'warning',
			severity: NotificationSeverity.CRITICAL,
			title: 'Primeiro',
			buttons: [
				{
					label: 'Avançar',
					type: 'primary',
					callback: () => {
						notificationService.showModal(
							'Processando operação...',
							'info',
							'Aguarde',
						);
					},
				},
			],
		});
		fixture.detectChanges();

		const actionButton = fixture.debugElement.query(
			By.css('.modal-footer button'),
		);
		actionButton.triggerEventHandler('click', null);
		fixture.detectChanges();

		expect(notificationService.modal()?.title).toBe('Aguarde');
	});
});
