import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, ViewContainerRef, ComponentRef, createComponent, EnvironmentInjector } from '@angular/core';
import { NotificationService } from '../../../service/notification.service';
import { ToastNotificationService } from '../../../service/toast-notification.service';
import { ModalNotificationService } from '../../../service/modal-notification.service';
import { Observable, Subscription } from 'rxjs';
import { ModalNotification, NotificationToast } from '../../../models/notification.models';
import { OverlayNotification } from '../../../service/notification/overlay-notification.strategy';
import { AsyncPipe, NgClass, NgIf, NgComponentOutlet } from '@angular/common';

@Component({
  selector: 'app-overlay-notification',
  imports: [NgClass, AsyncPipe, NgComponentOutlet],
  templateUrl: './overlay-notification.component.html',
  styleUrl: './overlay-notification.component.scss'
})
export class OverlayNotificationComponent implements OnInit, OnDestroy {
  @ViewChild('modalContent') modalContentRef!: ElementRef<HTMLDivElement>;
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastNotificationService);
  private modalService = inject(ModalNotificationService);
  private environmentInjector = inject(EnvironmentInjector);
  private subs: Subscription[] = [];

  modal: ModalNotification | null = null;
  toast$: Observable<NotificationToast[]>;
  overlays: OverlayNotification[] = [];

  constructor() {
    this.toast$ = this.toastService.toast$;
  }

  ngOnInit() {
    // Subscreve aos novos observables do NotificationService refatorado
    this.subs.push(
      this.notificationService.toasts$.subscribe(toast => {
        // Toast já é gerenciado pelo ToastNotificationService
        // Mantido para compatibilidade se necessário
      })
    );

    this.subs.push(
      this.notificationService.overlays$.subscribe(overlay => {
        if (overlay) {
          this.overlays.push(overlay);
        }
      })
    );

    this.subs.push(
      this.notificationService.overlayDismiss$.subscribe(overlayId => {
        this.overlays = this.overlays.filter(o => o.id !== overlayId);
      })
    );

    this.subs.push(
      this.modalService.modal$.subscribe(modal => {
        if (modal) {
          this.modal = modal;
        }
      })
    );

    this.subs.push(
      this.notificationService.modals$.subscribe(modal => {
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

  dismissOverlay(overlayId: string) {
    this.overlays = this.overlays.filter(o => o.id !== overlayId);
  }
}
