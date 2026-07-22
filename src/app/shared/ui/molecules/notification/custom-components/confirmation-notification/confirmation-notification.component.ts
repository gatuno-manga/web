import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
} from '@angular/core';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-confirmation-notification',
	standalone: true,
	imports: [IconsComponent],
	templateUrl: './confirmation-notification.component.html',
	styleUrls: ['./confirmation-notification.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationNotificationComponent {
	title = input<string>('Confirmação');
	message = input<string>('');
	details = input<string[]>();
	showWarning = input<boolean>(true);

	hasDetails = computed(() => {
		const d = this.details();
		return !!d && d.length > 0;
	});
}
