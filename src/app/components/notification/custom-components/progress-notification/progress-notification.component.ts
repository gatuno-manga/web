import { Component, Input, signal, computed } from '@angular/core';
import { IconsComponent } from '@components/icons/icons.component';

@Component({
    selector: 'app-progress-notification',
    standalone: true,
    imports: [IconsComponent],
    templateUrl: './progress-notification.component.html',
    styleUrls: ['./progress-notification.component.scss']
})
export class ProgressNotificationComponent {
    @Input() title: string = 'Processando';
    @Input() progress: number = 0;
    @Input() statusMessage: string = 'Aguarde...';
    @Input() currentItem?: string;

    hasCurrentItem = computed(() => !!this.currentItem);
}
