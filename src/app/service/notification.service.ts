import { Injectable } from "@angular/core";
import { Subject, Observable } from "rxjs";
import { NotificationToast, ModalNotification } from "../models/notification.models";
import { NotificationFactory } from "./notification/notification.factory";
import {
    NotificationConfig,
    NotificationLevel,
    NotificationSeverity,
    INotificationStrategy
} from "./notification/notification-strategy.interface";
import { OverlayNotification } from "./notification/overlay-notification.strategy";

/**
 * Serviço de notificações usando o padrão Factory Method
 *
 * Benefícios:
 * - Desacoplamento: O serviço não precisa conhecer as implementações concretas
 * - Extensibilidade: Novos tipos de notificação podem ser adicionados sem modificar este serviço
 * - Flexibilidade: A decisão de qual tipo usar é delegada ao factory
 * - Manutenibilidade: Lógica de criação centralizada no factory
 *
 * O padrão Factory Method é aplicado através da classe NotificationFactory,
 * que decide qual estratégia concreta de notificação criar baseada no contexto.
 */
@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    // Subjects para diferentes tipos de notificação
    private toastSubject = new Subject<NotificationToast>();
    private modalSubject = new Subject<ModalNotification | null>();
    private overlaySubject = new Subject<OverlayNotification>();
    private overlayDismissSubject = new Subject<string>();

    // Observables públicos para os componentes se inscreverem
    public toasts$: Observable<NotificationToast> = this.toastSubject.asObservable();
    public modals$: Observable<ModalNotification | null> = this.modalSubject.asObservable();
    public overlays$: Observable<OverlayNotification> = this.overlaySubject.asObservable();
    public overlayDismiss$: Observable<string> = this.overlayDismissSubject.asObservable();

    // Factory para criar estratégias de notificação
    private factory: NotificationFactory;

    constructor() {
        this.factory = new NotificationFactory(
            this.toastSubject,
            this.modalSubject,
            this.overlaySubject,
            this.overlayDismissSubject
        );
    }

    /**
     * Método principal para mostrar notificações
     * O factory decide automaticamente qual tipo de notificação criar
     *
     * @param config Configuração da notificação
     * @returns A estratégia criada (útil para controle manual se necessário)
     */
    notify(config: NotificationConfig): INotificationStrategy {
        const strategy = this.factory.createNotificationStrategy(config);
        strategy.display();
        return strategy;
    }

    /**
     * Métodos de conveniência para casos comuns
     * Abstraem a criação da configuração para os casos mais frequentes
     */

    success(message: string, title?: string, severity?: NotificationSeverity): INotificationStrategy {
        return this.notify({
            message,
            title,
            level: 'success',
            severity
        });
    }

    error(message: string, title?: string, severity?: NotificationSeverity): INotificationStrategy {
        return this.notify({
            message,
            title,
            level: 'error',
            severity
        });
    }

    warning(message: string, title?: string, severity?: NotificationSeverity): INotificationStrategy {
        return this.notify({
            message,
            title,
            level: 'warning',
            severity
        });
    }

    info(message: string, title?: string, severity?: NotificationSeverity): INotificationStrategy {
        return this.notify({
            message,
            title,
            level: 'info',
            severity
        });
    }

    critical(message: string, title?: string): INotificationStrategy {
        return this.notify({
            message,
            title,
            level: 'critical',
            severity: NotificationSeverity.CRITICAL
        });
    }

    /**
     * Métodos para criar tipos específicos de notificação
     * Útil quando você quer forçar um tipo específico independente do contexto
     */

    showToast(message: string, level: NotificationLevel, duration?: number): INotificationStrategy {
        const strategy = this.factory.createToast({
            message,
            level,
            duration
        });
        strategy.display();
        return strategy;
    }

    showModal(message: string, level: NotificationLevel, title?: string): INotificationStrategy {
        const strategy = this.factory.createModal({
            message,
            level,
            title
        });
        strategy.display();
        return strategy;
    }

    showOverlay(message: string, level: NotificationLevel, title?: string, dismissible = true): INotificationStrategy {
        const strategy = this.factory.createOverlay({
            message,
            level,
            title,
            dismissible
        });
        strategy.display();
        return strategy;
    }

    /**
     * Método legado para compatibilidade com código existente
     * @deprecated Use os novos métodos tipados (success, error, etc) ou notify()
     */
    show(message: string, type: NotificationLevel = 'info'): void {
        this.notify({ message, level: type });
    }
}
