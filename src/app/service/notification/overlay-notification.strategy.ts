import { Subject } from 'rxjs';
import { INotificationStrategy, NotificationConfig, NotificationComponentData } from './notification-strategy.interface';

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
 * Exibe notificações importantes que permanecem na tela até serem dispensadas
 * Não bloqueiam a interação do usuário como os modais
 */
export class OverlayNotificationStrategy implements INotificationStrategy {
    private static idCounter = 0;
    private overlaySubject: Subject<OverlayNotification>;
    private overlayId: string;
    private dismissSubject: Subject<string>;

    constructor(
        private config: NotificationConfig,
        overlaySubject: Subject<OverlayNotification>,
        dismissSubject: Subject<string>
    ) {
        this.overlaySubject = overlaySubject;
        this.dismissSubject = dismissSubject;
        this.overlayId = `overlay-${++OverlayNotificationStrategy.idCounter}`;
    }

    display(): void {
        const overlay: OverlayNotification = {
            id: this.overlayId,
            message: this.config.message,
            type: this.mapLevelToType(),
            title: this.config.title,
            dismissible: this.config.dismissible !== false,
            component: this.config.component,
            componentData: this.config.componentData
        };

        this.overlaySubject.next(overlay);

        // Auto-dismissão se configurado
        if (this.config.duration && this.config.duration > 0) {
            setTimeout(() => this.dismiss(), this.config.duration);
        }
    }

    dismiss(): void {
        this.dismissSubject.next(this.overlayId);
    }

    private mapLevelToType(): 'success' | 'error' | 'info' | 'warning' {
        // Mapeia critical para error no tipo do overlay
        if (this.config.level === 'critical') {
            return 'error';
        }
        return this.config.level as 'success' | 'error' | 'info' | 'warning';
    }
}
