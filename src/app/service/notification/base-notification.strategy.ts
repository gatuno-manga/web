import { INotificationStrategy, NotificationConfig } from './notification-strategy.interface';

/**
 * Classe base abstrata para estratégias de notificação.
 * Implementa lógica comum para evitar duplicação.
 */
export abstract class BaseNotificationStrategy implements INotificationStrategy {
    protected static idCounter = 0;

    constructor(protected config: NotificationConfig) {}

    abstract display(): void;
    abstract dismiss(): void;

    /**
     * Gera um ID único para a notificação
     */
    protected generateId(prefix: string): string {
        return `${prefix}-${++BaseNotificationStrategy.idCounter}`;
    }

    /**
     * Mapeia o nível da notificação para o tipo visual
     */
    protected mapLevelToType(): 'success' | 'error' | 'info' | 'warning' {
        if (this.config.level === 'critical') {
            return 'error';
        }
        return this.config.level as 'success' | 'error' | 'info' | 'warning';
    }
}
