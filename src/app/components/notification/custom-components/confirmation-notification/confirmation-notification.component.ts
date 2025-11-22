import { Component, Input } from '@angular/core';


@Component({
    selector: 'app-confirmation-notification',
    standalone: true,
    imports: [],
    templateUrl: './confirmation-notification.component.html',
    styleUrls: ['./confirmation-notification.component.scss']
})
export class ConfirmationNotificationComponent {
    @Input() title: string = 'Confirmação';
    @Input() message: string = '';
    @Input() details?: string[];
    @Input() showWarning: boolean = true;
}
