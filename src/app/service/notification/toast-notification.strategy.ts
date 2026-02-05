import { Subject } from 'rxjs';
import { BaseNotificationStrategy } from './base-notification.strategy';
import { NotificationConfig } from './notification-strategy.interface';
import { NotificationToast } from '../../models/notification.models';

/**
 * Implementação concreta da estratégia de notificação Toast
 * Exibe notificações leves e temporárias que desaparecem automaticamente
 */
export class ToastNotificationStrategy extends BaseNotificationStrategy {
    // Sobrescrevendo para manter compatibilidade com o tipo numérico do Toast atual (se necessário)
    // ou podemos refatorar o modelo de Toast para usar string no futuro.
    // Por enquanto, vou manter a lógica interna de ID numérico específica do Toast se o modelo exigir number,
    // mas o generateId da base retorna string. Vamos verificar o modelo NotificationToast.
    // O modelo NotificationToast usa id: number.
    
    private toastId: number;

    constructor(
        config: NotificationConfig,
        private toastSubject: Subject<NotificationToast>
    ) {
        super(config);
        // Incrementamos o contador da base, mas usamos como number aqui
        this.toastId = ++BaseNotificationStrategy.idCounter;
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
            componentData: this.config.componentData as any
        };

        this.toastSubject.next(toast);
    }

    dismiss(): void {
        // Toast se auto-destrói após o timeout
    }

    private getDefaultDuration(): number {
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