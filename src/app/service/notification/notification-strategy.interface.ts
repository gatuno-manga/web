/**
 * Interface base para estratégias de notificação
 * Define o contrato que todas as implementações concretas devem seguir
 */
export interface INotificationStrategy {
    /**
     * Exibe a notificação usando a estratégia específica
     */
    display(): void;

    /**
     * Fecha/remove a notificação
     */
    dismiss(): void;
}

/**
 * Tipos de notificação disponíveis
 */
export type NotificationLevel = 'success' | 'error' | 'info' | 'warning' | 'critical' | 'custom';

/**
 * Severidade da notificação para determinar o tipo de exibição
 */
export enum NotificationSeverity {
    LOW = 'low',        // Toast
    MEDIUM = 'medium',  // Toast com duração maior ou Overlay
    HIGH = 'high',      // Overlay
    CRITICAL = 'critical' // Modal
}

/**
 * Dados que podem ser passados para o componente personalizado
 */
export interface NotificationComponentData {
    [key: string]: unknown;
}

/**
 * Configuração base para todas as notificações
 */
export interface NotificationConfig<T = unknown> {
    message: string;
    level: NotificationLevel;
    severity?: NotificationSeverity;
    title?: string;
    duration?: number;
    dismissible?: boolean;
    /**
     * Componente personalizado a ser renderizado
     * Se fornecido, substitui a renderização padrão da notificação
     */
    component?: any;
    /**
     * Dados a serem passados para o componente personalizado
     */
    componentData?: T;
    /**
     * Se true, usa backdrop escuro (padrão: true para modais com componentes personalizados)
     */
    useBackdrop?: boolean;
    /**
     * Opacidade do backdrop (0.0 a 1.0, padrão: 0.75 para componentes personalizados)
     */
    backdropOpacity?: number;
}