import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ModalNotificationService } from '@core/services/modal-notification.service';
import { NetworkStatusService } from '@core/services/network-status.service';

export const networkGuard: CanActivateFn = (_route, _state) => {
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
					callback: () => router.navigate(['/home']),
				},
			],
			'warning',
		);
		return false;
	}
	return true;
};
