import { Component, Input, signal, computed } from '@angular/core';
import { IconsComponent } from '@components/icons/icons.component';
import { ButtonComponent } from '@components/inputs/button/button.component';

@Component({
    selector: 'app-success-details-notification',
    standalone: true,
    imports: [IconsComponent, ButtonComponent],
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

    hasItems = computed(() => !!this.items && this.items.length > 0);
    hasAction = computed(() => !!this.actionLabel && !!this.actionCallback);
}
