import { Component, inject } from '@angular/core';
import { NotificationService } from '../../../service/notification.service';
import { ToastNotificationService } from '../../../service/toast-notification.service';
import { ModalNotificationService } from '../../../service/modal-notification.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass, NgComponentOutlet } from '@angular/common';

@Component({
  selector: 'app-overlay-notification',
  standalone: true,
  imports: [NgComponentOutlet],
  templateUrl: './overlay-notification.component.html',
  styleUrl: './overlay-notification.component.scss'
})
export class OverlayNotificationComponent {
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastNotificationService);
  private modalService = inject(ModalNotificationService);

  // Facade pattern: Consumindo dados reativos (Signals)
  // Nota: Para modal e toast, mantemos o padrão anterior por enquanto se não foram refatorados no service para signals
  // ou usamos toSignal para compatibilidade.
  
  // Como o modalService.modal$ é um Observable, convertemos para signal
  modal = toSignal(this.modalService.modal$);
  
  // O mesmo para modals vindos do NotificationService
  legacyModal = toSignal(this.notificationService.modals$);
  
  // Overlays agora vêm diretamente do Signal do serviço
  overlays = this.notificationService.overlays;

  constructor() {
    // Mantendo a integração legado para Toasts, já que o ToastService parece gerenciar a exibição
    // Idealmente, ToastService deveria ser absorvido pelo NotificationService ou usar Signals também
    this.notificationService.toasts$.subscribe(toast => {
      this.toastService.show(toast.message, toast.timeout, toast.type);
    });
    
    // Mantendo sync entre os dois servicos de modal se necessário
    this.notificationService.modals$.subscribe(modal => {
       this.handleBodyScroll(!!modal);
    });

    this.modalService.modal$.subscribe(modal => {
        this.handleBodyScroll(!!modal);
    });
  }

  private handleBodyScroll(isOpen: boolean) {
      if (typeof document !== 'undefined') { // Check for SSR compatibility
          if (isOpen) {
              document.body.style.overflow = 'hidden';
          } else {
              document.body.style.overflow = '';
          }
      }
  }

  dismissToast(id: number) {
    this.toastService.dismiss(id);
  }

  dismissOverlay(overlayId: string) {
    this.notificationService.dismissOverlay(overlayId);
  }

  closeModal() {
    this.modalService.close();
    this.notificationService.dismissModal();
  }

  
  // Helper para combinar os modais (caso existam duas fontes)
  get currentModal() {
      return this.modal() || this.legacyModal();
  }
}