import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
	NotificationToast,
	NotificationType,
} from '../models/notification.models';
import { NotificationService } from './notification.service';
import { NotificationSeverity } from './notification/notification-strategy.interface';

@Injectable({ providedIn: 'root' })
export class ToastNotificationService {
	private notificationService = inject(NotificationService);

	/**
	 * @deprecated Use NotificationService.toasts signal instead.
	 */
	public toast$ = toObservable(this.notificationService.toasts);

	show(message: string, timeout = 5000, type: NotificationType = 'info') {
		this.notificationService.notify({
			message,
			duration: timeout,
			level: type,
			severity: NotificationSeverity.LOW,
		});
	}

	public dismiss(id: number) {
		this.notificationService.dismissToast(id);
	}
}
