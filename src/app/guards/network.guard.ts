import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { ModalNotificationService } from '../service/modal-notification.service';

export const networkGuard: CanActivateFn = (route, state) => {
  const platformId = inject(PLATFORM_ID);
  const modalService = inject(ModalNotificationService);
  const router = inject(Router);

  if (isPlatformBrowser(platformId)) {
    if (!navigator.onLine) {
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
  }
  return true;
};
