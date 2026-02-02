import { Subject } from 'rxjs';
import {
    INotificationStrategy,
    NotificationConfig,
    NotificationSeverity
} from './notification-strategy.interface';
import { ToastNotificationStrategy } from './toast-notification.strategy';
import { ModalNotificationStrategy } from './modal-notification.strategy';
import { OverlayNotificationStrategy, OverlayNotification } from './overlay-notification.strategy';
import { NotificationToast, ModalNotification } from '../../models/notification.models';

/**
 * Factory Method para criação de estratégias de notificação
 *
 * Este padrão permite:
 * - Desacoplar o NotificationService das implementações concretas
 * - Facilitar a adição de novos tipos de notificação
 * - Centralizar a lógica de decisão sobre qual estratégia usar
 * - Seguir o princípio Open/Closed (aberto para extensão, fechado para modificação)
 */
export class NotificationFactory {
    constructor(
        private toastSubject: Subject<NotificationToast>,
        private modalSubject: Subject<ModalNotification | null>,
        private overlaySubject: Subject<OverlayNotification>,
        private overlayDismissSubject: Subject<string>
    ) {}

    /**
     * Factory Method - cria a estratégia apropriada baseada na configuração
     *
     * A decisão é baseada em:
     * 1. Severidade explícita se fornecida
     * 2. Nível da notificação (critical -> modal)
     * 3. Contexto adicional (duração, dismissível, etc)
     *
     * @param config Configuração da notificação
     * @returns Estratégia concreta de notificação
     */
    createNotificationStrategy(config: NotificationConfig): INotificationStrategy {
        const severity = config.severity || this.determineSeverity(config);

        switch (severity) {
            case NotificationSeverity.CRITICAL:
                return this.createModalStrategy(config);

            case NotificationSeverity.HIGH:
                return this.createOverlayStrategy(config);

            case NotificationSeverity.MEDIUM:
                // Toast com duração maior ou Overlay se não for dismissível
                if (config.dismissible === false) {
                    return this.createOverlayStrategy(config);
                }
                return this.createToastStrategy(config);

            case NotificationSeverity.LOW:
            default:
                return this.createToastStrategy(config);
        }
    }

    /**
     * Determina a severidade baseada no contexto da notificação
     */
    private determineSeverity(config: NotificationConfig): NotificationSeverity {
        if (config.severity) {
            return config.severity;
        }

        if (config.level === 'critical') {
            return NotificationSeverity.CRITICAL;
        }

        const isError = config.level === 'error';
        const isWarning = config.level === 'warning';
        const notDismissible = config.dismissible === false;

        // Regras de Alta Severidade
        if ((isError && config.title) || (isWarning && notDismissible)) {
            return NotificationSeverity.HIGH;
        }

        // Regras de Média Severidade
        if (isError || isWarning) {
            return NotificationSeverity.MEDIUM;
        }

        // Success e info são de baixa severidade (toast)
        return NotificationSeverity.LOW;
    }

    /**
     * Cria estratégia de Toast
     */
    private createToastStrategy(config: NotificationConfig): INotificationStrategy {
        return new ToastNotificationStrategy(config, this.toastSubject);
    }

    /**
     * Cria estratégia de Modal
     */
    private createModalStrategy(config: NotificationConfig): INotificationStrategy {
        return new ModalNotificationStrategy(config, this.modalSubject);
    }

    /**
     * Cria estratégia de Overlay
     */
    private createOverlayStrategy(config: NotificationConfig): INotificationStrategy {
        return new OverlayNotificationStrategy(
            config,
            this.overlaySubject,
            this.overlayDismissSubject
        );
    }

    /**
     * Métodos auxiliares para criação direta de tipos específicos
     * Útil quando o cliente sabe exatamente qual tipo quer criar
     */

    createToast(config: NotificationConfig): INotificationStrategy {
        return this.createToastStrategy(config);
    }

    createModal(config: NotificationConfig): INotificationStrategy {
        return this.createModalStrategy(config);
    }

    createOverlay(config: NotificationConfig): INotificationStrategy {
        return this.createOverlayStrategy(config);
    }
}
