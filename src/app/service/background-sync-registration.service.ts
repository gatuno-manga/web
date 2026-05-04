import { Injectable, Inject } from '@angular/core';
import { WINDOW } from '../tokens/window.token';
import { logConnectionEvent, logWebSocketError, LogLevel } from '../utils/websocket-logger.utils';

/**
 * Serviço especializado no registro de Background Sync do Service Worker.
 * Isola a lógica de infraestrutura do navegador.
 */
@Injectable({
	providedIn: 'root',
})
export class BackgroundSyncRegistrationService {
	private readonly serviceName = 'BackgroundSyncRegistration';
	private isBrowser: boolean;

	constructor(@Inject(WINDOW) private window: Window) {
		this.isBrowser = typeof this.window.location !== 'undefined';
	}

	/**
	 * Registra o evento de Background Sync no Service Worker.
	 * @param tagName O nome da tag para o evento de sincronização.
	 */
	async register(tagName: string): Promise<void> {
		if (
			!this.isBrowser ||
			!('serviceWorker' in navigator) ||
			!('SyncManager' in window)
		) {
			return;
		}

		try {
			const registration = await navigator.serviceWorker.ready;
			// Usando 'any' pois SyncManager não está no tipo padrão de ServiceWorkerRegistration em todos os ambientes
			await (registration as any).sync.register(tagName);
			
			logConnectionEvent(
				this.serviceName,
				'sync',
				`Background Sync registrado: ${tagName}`,
				LogLevel.INFO,
			);
		} catch (err) {
			logWebSocketError(
				this.serviceName,
				err,
				`Falha ao registrar Background Sync (${tagName})`,
			);
			throw err;
		}
	}
}
