import { Component, inject, effect } from '@angular/core';
import { NotificationService } from '@core/services/notification.service';
import { BodyScrollService } from '@core/services/body-scroll.service';
import { NgComponentOutlet } from '@angular/common';

@Component({
	selector: 'app-overlay-notification',
	standalone: true,
	imports: [NgComponentOutlet],
	templateUrl: './overlay-notification.component.html',
	styleUrl: './overlay-notification.component.scss',
})
export class OverlayNotificationComponent {
	public notificationService = inject(NotificationService);
	private bodyScrollService = inject(BodyScrollService);

	// Consumindo dados reativos (Signals) do serviço unificado
	toasts = this.notificationService.toasts;
	modal = this.notificationService.modal;
	overlays = this.notificationService.overlays;

	constructor() {
		// Efeito para gerenciar o scroll do body baseado no estado da modal
		effect(() => {
			const isModalOpen = !!this.modal();
			if (isModalOpen) {
				this.bodyScrollService.disableScroll();
			} else {
				this.bodyScrollService.enableScroll();
			}
		});
	}

	onModalButtonClick(callback?: () => void): void {
		this.notificationService.dismissModal();
		callback?.();
	}
}
