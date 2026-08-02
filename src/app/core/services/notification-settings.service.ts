import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
	Injectable,
	inject,
	PLATFORM_ID,
	signal,
	DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class NotificationSettingsService {
	private http = inject(HttpClient);
	private swPush = inject(SwPush, { optional: true });
	private platformId = inject(PLATFORM_ID);
	private destroyRef = inject(DestroyRef);

	public isPushSupported = signal(false);
	public isPushEnabled = signal(false);
	public enableAllNotifications = signal(true);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			// Carregar preferência geral
			const savedAll = localStorage.getItem('gatuno_enable_all_notif');
			if (savedAll !== null) {
				this.enableAllNotifications.set(savedAll === 'true');
			}

			// Verificar suporte ao Push
			this.isPushSupported.set(this.swPush?.isEnabled ?? false);

			// Inscrever para saber se o Push está ativo
			if (this.swPush?.isEnabled) {
				this.swPush.subscription
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe((sub) => {
						this.isPushEnabled.set(!!sub);
					});
			}
		}
	}

	toggleAllNotifications(enable: boolean) {
		this.enableAllNotifications.set(enable);
		if (isPlatformBrowser(this.platformId)) {
			localStorage.setItem('gatuno_enable_all_notif', enable.toString());
		}
	}

	async togglePushSubscription(enable: boolean): Promise<void> {
		if (!this.isPushSupported()) {
			throw new Error(
				'Push notifications não suportadas neste navegador.',
			);
		}

		if (enable) {
			try {
				// 1. Pegar a chave pública do VAPID
				const res = await firstValueFrom(
					this.http.get<{ publicKey: string }>(
						'/notifications/push/vapid-key',
					),
				);
				// A chave pode vir como res.publicKey ou apenas res (se retornar plain text ou outro formato,
				// ajustamos conforme necessário, assumindo {publicKey: string})
				const vapidPublicKey = res.publicKey;

				// 2. Pedir permissão no browser e gerar subscription
				const sub = await this.swPush?.requestSubscription({
					serverPublicKey: vapidPublicKey,
				});

				// 3. Enviar para o backend
				await firstValueFrom(
					this.http.post('/notifications/push/subscribe', sub),
				);

				this.isPushEnabled.set(true);
			} catch (e) {
				console.error('Erro ao inscrever para push notifications:', e);
				this.isPushEnabled.set(false);
				throw e;
			}
		} else {
			try {
				// 1. Dizer para o backend apagar
				await firstValueFrom(
					this.http.delete('/notifications/push/unsubscribe'),
				);
				// 2. Desinscrever localmente no Service Worker
				await this.swPush?.unsubscribe();
				this.isPushEnabled.set(false);
			} catch (e) {
				console.error('Erro ao cancelar push notifications:', e);
				throw e;
			}
		}
	}
}
