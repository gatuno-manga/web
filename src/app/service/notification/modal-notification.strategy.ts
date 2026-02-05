import { Subject } from 'rxjs';
import { BaseNotificationStrategy } from './base-notification.strategy';
import { NotificationConfig } from './notification-strategy.interface';
import { ModalNotification, ModalButton } from '../../models/notification.models';

/**
 * Implementação concreta da estratégia de notificação Modal
 */
export class ModalNotificationStrategy extends BaseNotificationStrategy {
    private currentModal: ModalNotification | null = null;

    constructor(
        config: NotificationConfig,
        private modalSubject: Subject<ModalNotification | null>
    ) {
        super(config);
    }

    display(): void {
        const buttons = this.createButtons();

        this.currentModal = {
            title: this.config.title || this.getDefaultTitle(),
            description: this.config.message,
            type: this.mapLevelToType(),
            buttons,
            component: this.config.component,
            componentData: this.config.componentData as any,
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

    private createButtons(): ModalButton[] {
        const buttons: ModalButton[] = [];

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