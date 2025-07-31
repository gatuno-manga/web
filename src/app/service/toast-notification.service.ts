import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Notification, NotificationToast, NotificationType } from '../models/notification.models';

@Injectable({ providedIn: 'root' })
export class ToastNotificationService {
    private toastNotifications: NotificationToast[] = [];
    private toastSubject = new BehaviorSubject<NotificationToast[]>([]);
    public toast$ = this.toastSubject.asObservable();

    private static nextId = 0;

    show(message: string, timeout: number = 5000, type: NotificationType = 'info') {
        const id = ToastNotificationService.nextId++;
        console.log(id);
        const toast: NotificationToast = { id, message, timeout, type };

        this.toastNotifications = [...this.toastNotifications, toast];
        this.toastSubject.next(this.toastNotifications);

        if (timeout > 0) {
            setTimeout(() => {
                this.dismiss(id);
            }, timeout);
        }
    }

    public dismiss(id: number) {
        this.toastNotifications = this.toastNotifications.filter(n => n.id !== id);
        this.toastSubject.next(this.toastNotifications);
    }
}
