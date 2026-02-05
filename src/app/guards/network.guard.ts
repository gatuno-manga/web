import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ModalNotificationService } from '../service/modal-notification.service';
import { NetworkStatusService } from '../service/network-status.service';

export const networkGuard: CanActivateFn = (route, state) => {
  const networkStatus = inject(NetworkStatusService);
  const modalService = inject(ModalNotificationService);
  const router = inject(Router);

  if (!networkStatus.isOnline()) {
    modalService.show(
      'Sem conexão',
      'O Dashboard não está disponível no modo offline.',
      [
        {
          label: 'Entendi',
          type: 'primary',
          callback: () => router.navigate(['/home'])
        }
      ],
      'warning'
    );
    return false;
  }
  return true;
};
