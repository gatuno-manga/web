import { Type } from '@angular/core';
import { ModalButton } from '../../models/notification.models';

/**
 * Tipos de notificação disponíveis
 */
export type NotificationLevel =
	| 'success'
	| 'error'
	| 'info'
	| 'warning'
	| 'critical'
	| 'custom';

/**
 * Tipo visual da notificação (subconjunto sem 'critical' e 'custom')
 */
export type NotificationVisualType = 'success' | 'error' | 'info' | 'warning';

/**
 * Severidade da notificação para determinar o tipo de exibição
 */
export enum NotificationSeverity {
	LOW = 'low', // Toast
	MEDIUM = 'medium', // Toast com duração maior ou Overlay
	HIGH = 'high', // Overlay
	CRITICAL = 'critical', // Modal
}

/**
 * Dados que podem ser passados para o componente personalizado
 */
export type NotificationComponentData = Record<string, unknown>;

/**
 * Constantes padrão para notificações
 */
export const NOTIFICATION_CONSTANTS = {
	DURATIONS: {
		SHORT: 3000,
		MEDIUM: 5000,
		LONG: 8000,
		NEVER: 0,
	},
	BACKDROP: {
		DEFAULT_OPACITY: 0.75,
		OVERLAY_OPACITY: 0.3,
	},
} as const;

/**
 * Configuração base para todas as notificações
 */
export interface NotificationConfig<
	T extends NotificationComponentData = NotificationComponentData,
> {
	message: string;
	level: NotificationLevel;
	severity?: NotificationSeverity;
	title?: string;
	duration?: number;
	dismissible?: boolean;
	/**
	 * Botões para serem exibidos em modais
	 */
	buttons?: ModalButton[];
	/**
	 * Componente personalizado a ser renderizado
	 * Se fornecido, substitui a renderização padrão da notificação
	 */
	component?: Type<unknown>;
	/**
	 * Dados a serem passados para o componente personalizado
	 */
	componentData?: T;
	/**
	 * Se true, usa backdrop escuro (padrão: true para modais com componentes personalizados)
	 */
	useBackdrop?: boolean;
	/**
	 * Opacidade do backdrop (0.0 a 1.0, padrão: 0.75 para componentes personalizados)
	 */
	backdropOpacity?: number;
}

/**
 * Resultado da criação de uma notificação pelo factory.
 * Discriminated union por 'kind' para facilitar o roteamento no service.
 */
export type NotificationResult =
	| {
			kind: 'toast';
			data: import('../../models/notification.models').NotificationToast;
	  }
	| {
			kind: 'modal';
			data: import('../../models/notification.models').ModalNotification;
	  }
	| { kind: 'overlay'; data: OverlayNotificationData };

/**
 * Dados de uma notificação overlay
 */
export interface OverlayNotificationData {
	id: string;
	message: string;
	type: NotificationVisualType;
	title?: string;
	dismissible: boolean;
	component?: Type<unknown>;
	componentData?: NotificationComponentData;
}
