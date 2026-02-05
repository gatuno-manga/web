import { Component, Input, signal, computed } from '@angular/core';
import { IconsComponent } from '@components/icons/icons.component';

@Component({
    selector: 'app-confirmation-notification',
    standalone: true,
    imports: [IconsComponent],
    templateUrl: './confirmation-notification.component.html',
    styleUrls: ['./confirmation-notification.component.scss']
})
export class ConfirmationNotificationComponent {
    @Input() title: string = 'Confirmação';
    @Input() message: string = '';
    @Input() details?: string[];
    @Input() showWarning: boolean = true;

    hasDetails = computed(() => !!this.details && this.details.length > 0);
}
