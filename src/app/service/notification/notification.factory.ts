import {
	NotificationConfig,
	NotificationComponentData,
	NotificationSeverity,
	NotificationResult,
	NotificationVisualType,
	NotificationLevel,
	OverlayNotificationData,
	NOTIFICATION_CONSTANTS,
} from './notification-strategy.interface';
import {
	NotificationToast,
	ModalNotification,
	ModalButton,
} from '../../models/notification.models';

/**
 * Factory para criação de objetos de notificação.
 *
 * Responsável apenas por:
 * - Determinar a severidade com base na configuração
 * - Criar o objeto de dados correto (Toast, Modal ou Overlay)
 *
 * Não contém side-effects — a emissão de estado é responsabilidade do NotificationService.
 */
export class NotificationFactory {
	private static idCounter = 0;

	/**
	 * Cria o objeto de notificação apropriado baseado na configuração.
	 * Retorna um discriminated union `NotificationResult` com `kind` + `data`.
	 */
	create<T extends NotificationComponentData>(
		config: NotificationConfig<T>,
	): NotificationResult {
		const severity = config.severity || this.determineSeverity(config);

		switch (severity) {
			case NotificationSeverity.CRITICAL:
				return this.buildModal(config);

			case NotificationSeverity.HIGH:
				return this.buildOverlay(config);

			case NotificationSeverity.MEDIUM:
				if (config.dismissible === false) {
					return this.buildOverlay(config);
				}
				return this.buildToast(config);

			default:
				return this.buildToast(config);
		}
	}

	/**
	 * Criação direta de um Toast (ignora regras de severidade).
	 */
	createToast<T extends NotificationComponentData>(
		config: NotificationConfig<T>,
	): NotificationResult {
		return this.buildToast(config);
	}

	/**
	 * Criação direta de um Modal (ignora regras de severidade).
	 */
	createModal<T extends NotificationComponentData>(
		config: NotificationConfig<T>,
	): NotificationResult {
		return this.buildModal(config);
	}

	/**
	 * Criação direta de um Overlay (ignora regras de severidade).
	 */
	createOverlay<T extends NotificationComponentData>(
		config: NotificationConfig<T>,
	): NotificationResult {
		return this.buildOverlay(config);
	}

	// ───────────────────────────────────────────────
	// Builders privados
	// ───────────────────────────────────────────────

	private buildToast<T extends NotificationComponentData>(
		config: NotificationConfig<T>,
	): NotificationResult {
		const toast: NotificationToast = {
			id: ++NotificationFactory.idCounter,
			message: config.message,
			type: this.mapLevelToVisualType(config.level),
			timeout:
				config.duration ?? this.getDefaultToastDuration(config.level),
			image: undefined,
			link: undefined,
			component: config.component,
			componentData: config.componentData as Record<string, unknown>,
		};
		return { kind: 'toast', data: toast };
	}

	private buildModal<T extends NotificationComponentData>(
		config: NotificationConfig<T>,
	): NotificationResult {
		const buttons =
			config.buttons ?? this.createDefaultButtons(config.level);
		const modal: ModalNotification = {
			title: config.title ?? this.getDefaultModalTitle(config.level),
			description: config.message,
			type: this.mapLevelToVisualType(config.level),
			buttons,
			component: config.component,
			componentData: config.componentData as Record<string, unknown>,
			useBackdrop: config.useBackdrop,
			backdropOpacity: config.backdropOpacity,
		};
		return { kind: 'modal', data: modal };
	}

	private buildOverlay<T extends NotificationComponentData>(
		config: NotificationConfig<T>,
	): NotificationResult {
		const overlay: OverlayNotificationData = {
			id: `overlay-${++NotificationFactory.idCounter}`,
			message: config.message,
			type: this.mapLevelToVisualType(config.level),
			title: config.title,
			dismissible: config.dismissible !== false,
			component: config.component,
			componentData: config.componentData as NotificationComponentData,
		};
		return { kind: 'overlay', data: overlay };
	}

	// ───────────────────────────────────────────────
	// Utilitários privados
	// ───────────────────────────────────────────────

	private determineSeverity(
		config: NotificationConfig,
	): NotificationSeverity {
		if (config.level === 'critical') {
			return NotificationSeverity.CRITICAL;
		}

		const isError = config.level === 'error';
		const isWarning = config.level === 'warning';
		const notDismissible = config.dismissible === false;

		if ((isError && config.title) || (isWarning && notDismissible)) {
			return NotificationSeverity.HIGH;
		}

		if (isError || isWarning) {
			return NotificationSeverity.MEDIUM;
		}

		return NotificationSeverity.LOW;
	}

	private mapLevelToVisualType(
		level: NotificationLevel,
	): NotificationVisualType {
		if (level === 'critical') return 'error';
		if (level === 'custom') return 'info';
		return level as NotificationVisualType;
	}

	private getDefaultToastDuration(level: NotificationLevel): number {
		switch (level) {
			case 'error':
			case 'critical':
			case 'warning':
				return NOTIFICATION_CONSTANTS.DURATIONS.MEDIUM;
			default:
				return NOTIFICATION_CONSTANTS.DURATIONS.SHORT;
		}
	}

	private getDefaultModalTitle(level: NotificationLevel): string {
		switch (level) {
			case 'critical':
			case 'error':
				return 'Erro';
			case 'warning':
				return 'Atenção';
			case 'success':
				return 'Sucesso';
			default:
				return 'Informação';
		}
	}

	private createDefaultButtons(level: NotificationLevel): ModalButton[] {
		return [
			{
				label: 'OK',
				type:
					level === 'error' || level === 'critical'
						? 'danger'
						: 'primary',
			},
		];
	}
}
