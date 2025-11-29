import { Component, Input } from '@angular/core';


@Component({
    selector: 'app-progress-notification',
    standalone: true,
    imports: [],
    templateUrl: './progress-notification.component.html',
    styleUrls: ['./progress-notification.component.scss']
})
export class ProgressNotificationComponent {
    @Input() title: string = 'Processando';
    @Input() progress: number = 0;
    @Input() statusMessage: string = 'Aguarde...';
    @Input() currentItem?: string;
}
