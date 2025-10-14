import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente personalizado para notificação de sucesso com detalhes
 */
@Component({
    selector: 'app-success-details-notification',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './success-details-notification.component.html',
    styleUrls: ['./success-details-notification.component.scss']
})
export class SuccessDetailsNotificationComponent {
    @Input() title: string = 'Sucesso!';
    @Input() message: string = '';
    @Input() items?: string[];
    @Input() itemsTitle: string = 'Itens processados';
    @Input() actionLabel?: string;
    @Input() actionCallback?: () => void;
}
