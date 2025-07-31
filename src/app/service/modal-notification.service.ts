import { Injectable } from '@angular/core';

import { Subject } from 'rxjs';
import { ModalButton, ModalNotification } from '../models/notification.models';

@Injectable({ providedIn: 'root' })
export class ModalNotificationService {
    private modalSubject = new Subject<ModalNotification>();
    public modal$ = this.modalSubject.asObservable();

    show(title: string, description: string, buttons: ModalButton[], type: 'success' | 'error' | 'info' | 'warning') {
        this.modalSubject.next({ title, description, buttons, type });
    }
}
