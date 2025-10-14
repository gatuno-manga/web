import { Subject } from 'rxjs';
import { INotificationStrategy, NotificationConfig } from './notification-strategy.interface';
import { NotificationToast } from '../../models/notification.models';

/**
 * Implementação concreta da estratégia de notificação Toast
 * Exibe notificações leves e temporárias que desaparecem automaticamente
 */
export class ToastNotificationStrategy implements INotificationStrategy {
    private static idCounter = 0;
    private toastSubject: Subject<NotificationToast>;
    private toastId: number;

    constructor(
        private config: NotificationConfig,
        toastSubject: Subject<NotificationToast>
    ) {
        this.toastSubject = toastSubject;
        this.toastId = ++ToastNotificationStrategy.idCounter;
    }

    display(): void {
        const toast: NotificationToast = {
            id: this.toastId,
            message: this.config.message,
            type: this.mapLevelToType(),
            timeout: this.config.duration || this.getDefaultDuration(),
            image: undefined,
            link: undefined,
            component: this.config.component,
            componentData: this.config.componentData
        };

        this.toastSubject.next(toast);
    }

    dismiss(): void {
        // Toast se auto-destrói após o timeout
        // Pode ser implementado um método para fechar manualmente se necessário
    }

    private mapLevelToType(): 'success' | 'error' | 'info' | 'warning' {
        // Mapeia critical para error no tipo do toast
        if (this.config.level === 'critical') {
            return 'error';
        }
        return this.config.level as 'success' | 'error' | 'info' | 'warning';
    }

    private getDefaultDuration(): number {
        // Duração baseada no nível da notificação
        switch (this.config.level) {
            case 'error':
            case 'critical':
                return 5000;
            case 'warning':
                return 4000;
            case 'success':
                return 3000;
            default:
                return 3000;
        }
    }
}
