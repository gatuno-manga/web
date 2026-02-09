import { Type } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationBase {
	type: NotificationType;
	component?: Type<unknown>;
	componentData?: Record<string, unknown>;
	useBackdrop?: boolean;
	backdropOpacity?: number;
}

export interface ModalButton {
	label: string;
	callback?: () => void;
	type?: 'primary' | 'secondary' | 'danger';
}

export interface ModalNotification extends NotificationBase {
	title: string;
	description: string;
	buttons: ModalButton[];
}

interface NotificationText extends NotificationBase {
	message: string;
	image?: string;
	link?: string;
}

export interface NotificationToast extends NotificationText {
	id: number;
	timeout: number;
}

export interface Notification extends NotificationText {}
