import { Component, inject, effect } from '@angular/core';
import { NotificationService } from '../../../service/notification.service';
import { BodyScrollService } from '../../../service/body-scroll.service';
import { NgComponentOutlet } from '@angular/common';

@Component({
	selector: 'app-overlay-notification',
	standalone: true,
	imports: [NgComponentOutlet],
	templateUrl: './overlay-notification.component.html',
	styleUrl: './overlay-notification.component.scss',
})
export class OverlayNotificationComponent {
	private notificationService = inject(NotificationService);
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

	dismissToast(id: number) {
		this.notificationService.dismissToast(id);
	}

	dismissOverlay(overlayId: string) {
		this.notificationService.dismissOverlay(overlayId);
	}

	closeModal() {
		this.notificationService.dismissModal();
	}
}
