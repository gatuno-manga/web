import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente personalizado de exemplo para notificação de confirmação
 * Demonstra como criar um componente customizado para ser usado em notificações
 */
@Component({
    selector: 'app-confirmation-notification',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './confirmation-notification.component.html',
    styleUrls: ['./confirmation-notification.component.scss']
})
export class ConfirmationNotificationComponent {
    @Input() title: string = 'Confirmação';
    @Input() message: string = '';
    @Input() details?: string[];
    @Input() showWarning: boolean = true;
}
