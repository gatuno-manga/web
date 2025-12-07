import { Subject } from 'rxjs';
import { INotificationStrategy, NotificationConfig } from './notification-strategy.interface';
import { ModalNotification, ModalButton } from '../../models/notification.models';

/**
 * Implementação concreta da estratégia de notificação Modal
 * Exibe notificações críticas que requerem atenção imediata do usuário
 * e bloqueiam a interação até serem fechadas
 */
export class ModalNotificationStrategy implements INotificationStrategy {
    private modalSubject: Subject<ModalNotification | null>;
    private currentModal: ModalNotification | null = null;

    constructor(
        private config: NotificationConfig,
        modalSubject: Subject<ModalNotification | null>
    ) {
        this.modalSubject = modalSubject;
    }

    display(): void {
        const buttons = this.createButtons();

        this.currentModal = {
            title: this.config.title || this.getDefaultTitle(),
            description: this.config.message,
            type: this.mapLevelToType(),
            buttons,
            component: this.config.component,
            componentData: this.config.componentData,
            useBackdrop: this.config.useBackdrop,
            backdropOpacity: this.config.backdropOpacity
        };

        this.modalSubject.next(this.currentModal);
    }

    dismiss(): void {
        this.currentModal = null;
        this.modalSubject.next(null);
    }

    private getDefaultTitle(): string {
        switch (this.config.level) {
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

    private mapLevelToType(): 'success' | 'error' | 'info' | 'warning' {
        // Mapeia critical para error no tipo do modal
        if (this.config.level === 'critical') {
            return 'error';
        }
        return this.config.level as 'success' | 'error' | 'info' | 'warning';
    }

    private createButtons(): ModalButton[] {
        const buttons: ModalButton[] = [];

        // Botão padrão de OK/Fechar
        buttons.push({
            label: 'OK',
            type: this.config.level === 'error' || this.config.level === 'critical'
                ? 'danger'
                : 'primary',
            callback: () => this.dismiss()
        });

        return buttons;
    }
}
