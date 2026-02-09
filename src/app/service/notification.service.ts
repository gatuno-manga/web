import { Injectable, signal } from '@angular/core';
import {
	NotificationToast,
	ModalNotification,
} from '../models/notification.models';
import { NotificationFactory } from './notification/notification.factory';
import {
	NotificationConfig,
	NotificationLevel,
	NotificationSeverity,
	NotificationComponentData,
	OverlayNotificationData,
	NOTIFICATION_CONSTANTS,
} from './notification/notification-strategy.interface';

/**
 * Handle retornado ao criar uma notificação.
 * Permite que o chamador faça dismiss programático.
 */
export interface NotificationHandle {
	dismiss(): void;
}

/**
 * Serviço de notificações usando Factory + Signals.
 *
 * Estado 100% baseado em Signals — sem Subjects ou Observables intermediários.
 * O NotificationFactory cria objetos de dados puros; este serviço gerencia o estado.
 */
@Injectable({
	providedIn: 'root',
})
export class NotificationService {
	// ─── State (Signals) ─────────────────────────────
	private _toasts = signal<NotificationToast[]>([]);
	private _modal = signal<ModalNotification | null>(null);
	private _overlays = signal<OverlayNotificationData[]>([]);

	// Signals públicos (Read-only)
	public readonly toasts = this._toasts.asReadonly();
	public readonly modal = this._modal.asReadonly();
	public readonly overlays = this._overlays.asReadonly();

	// Timer IDs para cancelar auto-dismiss pendentes
	private toastTimers = new Map<number, ReturnType<typeof setTimeout>>();
	private overlayTimers = new Map<string, ReturnType<typeof setTimeout>>();

	// Factory puro (sem side-effects)
	private factory = new NotificationFactory();

	// ─── API principal ───────────────────────────────

	/**
	 * Método principal para mostrar notificações.
	 * O factory decide automaticamente o tipo (toast/modal/overlay) com base na config.
	 */
	notify<T extends NotificationComponentData = NotificationComponentData>(
		config: NotificationConfig<T>,
	): NotificationHandle {
		const result = this.factory.create(config);

		switch (result.kind) {
			case 'toast':
				return this.pushToast(result.data);
			case 'modal':
				return this.pushModal(result.data);
			case 'overlay':
				return this.pushOverlay(result.data, config.duration);
		}
	}

	// ─── Dismiss ─────────────────────────────────────

	dismissToast(id: number): void {
		const timer = this.toastTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.toastTimers.delete(id);
		}
		this._toasts.update((current) => current.filter((t) => t.id !== id));
	}

	dismissModal(): void {
		this._modal.set(null);
	}

	dismissOverlay(id: string): void {
		const timer = this.overlayTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.overlayTimers.delete(id);
		}
		this._overlays.update((current) => current.filter((o) => o.id !== id));
	}

	// ─── Métodos de conveniência ─────────────────────

	success(
		message: string,
		title?: string,
		severity?: NotificationSeverity,
	): NotificationHandle {
		return this.notify({ message, title, level: 'success', severity });
	}

	error(
		message: string,
		title?: string,
		severity?: NotificationSeverity,
	): NotificationHandle {
		return this.notify({ message, title, level: 'error', severity });
	}

	warning(
		message: string,
		title?: string,
		severity?: NotificationSeverity,
	): NotificationHandle {
		return this.notify({ message, title, level: 'warning', severity });
	}

	info(
		message: string,
		title?: string,
		severity?: NotificationSeverity,
	): NotificationHandle {
		return this.notify({ message, title, level: 'info', severity });
	}

	critical(message: string, title?: string): NotificationHandle {
		return this.notify({
			message,
			title,
			level: 'critical',
			severity: NotificationSeverity.CRITICAL,
		});
	}

	// ─── Criação direta por tipo ─────────────────────

	showToast(
		message: string,
		level: NotificationLevel,
		duration?: number,
	): NotificationHandle {
		const result = this.factory.createToast({ message, level, duration });
		return this.pushToast(result.data as NotificationToast);
	}

	showModal(
		message: string,
		level: NotificationLevel,
		title?: string,
	): NotificationHandle {
		const result = this.factory.createModal({ message, level, title });
		return this.pushModal(result.data as ModalNotification);
	}

	showOverlay(
		message: string,
		level: NotificationLevel,
		title?: string,
		dismissible = true,
	): NotificationHandle {
		const result = this.factory.createOverlay({
			message,
			level,
			title,
			dismissible,
		});
		return this.pushOverlay(result.data as OverlayNotificationData);
	}

	/**
	 * @deprecated Use os novos métodos tipados (success, error, etc) ou notify()
	 */
	show(message: string, type: NotificationLevel = 'info'): void {
		this.notify({ message, level: type });
	}

	// ─── Internos ────────────────────────────────────

	private pushToast(toast: NotificationToast): NotificationHandle {
		this._toasts.update((current) => [...current, toast]);

		if (toast.timeout > 0) {
			const timer = setTimeout(
				() => this.dismissToast(toast.id),
				toast.timeout,
			);
			this.toastTimers.set(toast.id, timer);
		}

		return { dismiss: () => this.dismissToast(toast.id) };
	}

	private pushModal(modal: ModalNotification): NotificationHandle {
		// Injeta callback de dismiss nos botões default que não têm callback
		const enrichedModal: ModalNotification = {
			...modal,
			buttons: modal.buttons.map((btn) =>
				btn.callback
					? btn
					: { ...btn, callback: () => this.dismissModal() },
			),
		};
		this._modal.set(enrichedModal);

		return { dismiss: () => this.dismissModal() };
	}

	private pushOverlay(
		overlay: OverlayNotificationData,
		duration?: number,
	): NotificationHandle {
		this._overlays.update((current) => [...current, overlay]);

		if (duration && duration > 0) {
			const timer = setTimeout(
				() => this.dismissOverlay(overlay.id),
				duration,
			);
			this.overlayTimers.set(overlay.id, timer);
		}

		return { dismiss: () => this.dismissOverlay(overlay.id) };
	}
}
