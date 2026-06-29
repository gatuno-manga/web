import { isPlatformBrowser } from '@angular/common';
import {
	computed,
	Injectable,
	inject,
	PLATFORM_ID,
	signal,
	WritableSignal,
} from '@angular/core';
import { NotificationFactory } from '@core/services/notification/notification.factory';
import {
	NotificationComponentData,
	NotificationConfig,
	NotificationLevel,
	NotificationSeverity,
	OverlayNotification,
} from '@core/services/notification/notification-strategy.interface';
import {
	HistoryNotification,
	ModalNotification,
	NotificationType,
	ToastNotification,
} from '@models/notification.models';
import { DBSchema, IDBPDatabase, openDB } from 'idb';

interface GatunoNotificationsDB extends DBSchema {
	notifications: {
		key: string;
		value: HistoryNotification;
		indexes: { 'by-date': Date };
	};
}

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
	private _toasts = signal<ToastNotification[]>([]);
	private _modal = signal<ModalNotification | null>(null);
	private _overlays = signal<OverlayNotification[]>([]);
	private _history = signal<HistoryNotification[]>([]);

	// Signals públicos (Read-only)
	public readonly toasts = this._toasts.asReadonly();
	public readonly modal = this._modal.asReadonly();
	public readonly overlays = this._overlays.asReadonly();
	public readonly history = this._history.asReadonly();
	public readonly unreadCount = computed(
		() => this._history().filter((n) => !n.read).length,
	);

	// Timer IDs para cancelar auto-dismiss pendentes
	private timers = new Map<string, ReturnType<typeof setTimeout>>();

	// Factory injetado
	private factory = inject(NotificationFactory);

	private dbPromise: Promise<IDBPDatabase<GatunoNotificationsDB>> | null =
		null;
	private platformId = inject(PLATFORM_ID);

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			this.dbPromise = openDB<GatunoNotificationsDB>(
				'GatunoNotificationsDB',
				1,
				{
					upgrade(db) {
						const store = db.createObjectStore('notifications', {
							keyPath: 'id',
						});
						store.createIndex('by-date', 'createdAt');
					},
				},
			);

			this.loadHistory();
		}
	}

	private async loadHistory() {
		if (!this.dbPromise) return;
		try {
			const db = await this.dbPromise;
			// Pega as últimas 50 notificações ordenadas por data
			const tx = db.transaction('notifications', 'readonly');
			const store = tx.objectStore('notifications');
			const index = store.index('by-date');
			let cursor = await index.openCursor(null, 'prev');

			const loaded: HistoryNotification[] = [];
			while (cursor && loaded.length < 50) {
				loaded.push(cursor.value);
				cursor = await cursor.continue();
			}

			this._history.set(loaded);
		} catch (e) {
			console.error(
				'Erro ao carregar histórico de notificações do IndexedDB',
				e,
			);
		}
	}

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

	dismissToast(id: string): void {
		this.dismissItem(this._toasts, id);
	}

	dismissModal(): void {
		this._modal.set(null);
	}

	dismissOverlay(id: string): void {
		this.dismissItem(this._overlays, id);
	}

	// ─── Histórico ───────────────────────────────────

	async addHistory(data: {
		title: string;
		message: string;
		type: NotificationType;
	}): Promise<void> {
		const newNotif: HistoryNotification = {
			id: crypto.randomUUID(),
			title: data.title,
			message: data.message,
			type: data.type,
			read: false,
			createdAt: new Date(),
		};
		this._history.update((h) => [newNotif, ...h]);

		if (!this.dbPromise) return;

		try {
			const db = await this.dbPromise;
			await db.put('notifications', newNotif);
		} catch (e) {
			console.error('Erro ao salvar notificação no IndexedDB', e);
		}
	}

	async markAllAsRead(): Promise<void> {
		const updated = this._history().map((n) => ({ ...n, read: true }));
		this._history.set(updated);

		if (!this.dbPromise) return;

		try {
			const db = await this.dbPromise;
			const tx = db.transaction('notifications', 'readwrite');
			for (const notif of updated) {
				tx.store.put(notif);
			}
			await tx.done;
		} catch (e) {
			console.error('Erro ao atualizar notificações no IndexedDB', e);
		}
	}

	async markAsRead(id: string): Promise<void> {
		let updatedNotif: HistoryNotification | undefined;
		this._history.update((h) =>
			h.map((n) => {
				if (n.id === id) {
					updatedNotif = { ...n, read: true };
					return updatedNotif;
				}
				return n;
			}),
		);

		if (updatedNotif && this.dbPromise) {
			try {
				const db = await this.dbPromise;
				await db.put('notifications', updatedNotif);
			} catch (e) {
				console.error('Erro ao atualizar notificação no IndexedDB', e);
			}
		}
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
		return this.pushToast(result.data as ToastNotification);
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
		return this.pushOverlay(result.data as OverlayNotification);
	}

	/**
	 * @deprecated Use os novos métodos tipados (success, error, etc) ou notify()
	 */
	show(message: string, type: NotificationLevel = 'info'): void {
		this.notify({ message, level: type });
	}

	// ─── Internos ────────────────────────────────────

	private pushToast(toast: ToastNotification): NotificationHandle {
		return this.pushItem(this._toasts, toast, toast.timeout);
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
		overlay: OverlayNotification,
		duration?: number,
	): NotificationHandle {
		return this.pushItem(this._overlays, overlay, duration);
	}

	private pushItem<T extends { id: string }>(
		signal: WritableSignal<T[]>,
		item: T,
		duration?: number,
	): NotificationHandle {
		signal.update((current) => [...current, item]);

		if (duration && duration > 0) {
			const timer = setTimeout(
				() => this.dismissItem(signal, item.id),
				duration,
			);
			this.timers.set(item.id, timer);
		}

		return { dismiss: () => this.dismissItem(signal, item.id) };
	}

	private dismissItem<T extends { id: string }>(
		signal: WritableSignal<T[]>,
		id: string,
	): void {
		const timer = this.timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(id);
		}
		signal.update((current) => current.filter((t) => t.id !== id));
	}
}
