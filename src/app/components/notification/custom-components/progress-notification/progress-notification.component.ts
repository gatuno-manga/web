import { Component, input, computed } from '@angular/core';
import { IconsComponent } from '@components/icons/icons.component';

@Component({
	selector: 'app-progress-notification',
	standalone: true,
	imports: [IconsComponent],
	templateUrl: './progress-notification.component.html',
	styleUrls: ['./progress-notification.component.scss'],
})
export class ProgressNotificationComponent {
	title = input<string>('Processando');
	progress = input<number>(0);
	statusMessage = input<string>('Aguarde...');
	currentItem = input<string | undefined>();

	hasCurrentItem = computed(() => !!this.currentItem());
}
