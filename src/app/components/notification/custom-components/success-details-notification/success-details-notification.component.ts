import { Component, Input } from '@angular/core';


@Component({
    selector: 'app-success-details-notification',
    standalone: true,
    imports: [],
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
