import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { NotificationService } from '../../../service/notification.service';
import { ToastNotificationService } from '../../../service/toast-notification.service';
import { ModalNotificationService } from '../../../service/modal-notification.service';
import { Observable, Subscription } from 'rxjs';
import { ModalNotification, Notification, NotificationToast } from '../../../models/notification.models';
import { AsyncPipe, NgClass, NgIf } from '@angular/common';

@Component({
  selector: 'app-overlay-notification',
  imports: [NgClass, AsyncPipe],
  templateUrl: './overlay-notification.component.html',
  styleUrl: './overlay-notification.component.scss'
})
export class OverlayNotificationComponent implements OnInit, OnDestroy {
  @ViewChild('modalContent') modalContentRef!: ElementRef<HTMLDivElement>;
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastNotificationService);
  private modalService = inject(ModalNotificationService);
  private subs: Subscription[] = [];

  modal: ModalNotification | null = null;
  toast$: Observable<NotificationToast[]>;
  notification: Notification | null = null;

  constructor() {
    this.toast$ = this.toastService.toast$;
  }

  ngOnInit() {
    this.subs.push(
      this.notificationService.notifications$.subscribe(notification => {
        if (notification) {
          this.notification = notification;
          setTimeout(() => {
            this.notification = null;
          }, 5000);

        }
      })
    );
    this.subs.push(
      this.modalService.modal$.subscribe(modal => {
        if (modal) {
          this.modal = modal;
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  dismissToast(id: number) {
    this.toastService.dismiss(id);
  }
}
