import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente personalizado para notificação de progresso
 */
@Component({
    selector: 'app-progress-notification',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './progress-notification.component.html',
    styleUrls: ['./progress-notification.component.scss']
})
export class ProgressNotificationComponent {
    @Input() title: string = 'Processando';
    @Input() progress: number = 0;
    @Input() statusMessage: string = 'Aguarde...';
    @Input() currentItem?: string;
}
