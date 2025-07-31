import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { Notification, NotificationType } from "../models/notification.models";

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private notificationSubject = new Subject<Notification>();
    public notifications$ = this.notificationSubject.asObservable();

    show(message: string, type: NotificationType = 'info') {
        this.notificationSubject.next({ message, type });
    }
}
