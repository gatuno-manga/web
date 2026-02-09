import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
	ModalButton,
	ModalNotification,
	NotificationType,
} from '../models/notification.models';
import { NotificationService } from './notification.service';
import { NotificationSeverity } from './notification/notification-strategy.interface';

@Injectable({ providedIn: 'root' })
export class ModalNotificationService {
	private notificationService = inject(NotificationService);

	/**
	 * @deprecated Use NotificationService.modal signal instead.
	 */
	public modal$ = toObservable(this.notificationService.modal);

	show(
		title: string,
		description: string,
		buttons: ModalButton[],
		type: NotificationType = 'info',
	) {
		this.notificationService.notify({
			title,
			message: description,
			buttons,
			level: type,
			severity: NotificationSeverity.CRITICAL,
		});
	}

	close() {
		this.notificationService.dismissModal();
	}
}
