import { Subject } from 'rxjs';
import { BaseNotificationStrategy } from './base-notification.strategy';
import { NotificationConfig, NotificationComponentData } from './notification-strategy.interface';

/**
 * Interface para notificações de overlay
 */
export interface OverlayNotification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title?: string;
    dismissible: boolean;
    component?: any;
    componentData?: NotificationComponentData;
}

/**
 * Implementação concreta da estratégia de notificação Overlay
 */
export class OverlayNotificationStrategy extends BaseNotificationStrategy {
    private overlayId: string;

    constructor(
        config: NotificationConfig,
        private overlaySubject: Subject<OverlayNotification>,
        private dismissSubject: Subject<string>
    ) {
        super(config);
        this.overlayId = this.generateId('overlay');
    }

    display(): void {
        const overlay: OverlayNotification = {
            id: this.overlayId,
            message: this.config.message,
            type: this.mapLevelToType(),
            title: this.config.title,
            dismissible: this.config.dismissible !== false,
            component: this.config.component,
            componentData: this.config.componentData as NotificationComponentData
        };

        this.overlaySubject.next(overlay);

        if (this.config.duration && this.config.duration > 0) {
            setTimeout(() => this.dismiss(), this.config.duration);
        }
    }

    dismiss(): void {
        this.dismissSubject.next(this.overlayId);
    }
}