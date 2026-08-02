import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
} from '@angular/core';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';

@Component({
	selector: 'app-success-details-notification',
	standalone: true,
	imports: [IconsComponent, ButtonComponent],
	templateUrl: './success-details-notification.component.html',
	styleUrls: ['./success-details-notification.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuccessDetailsNotificationComponent {
	title = input<string>('Sucesso!');
	message = input<string>('');
	items = input<string[]>();
	itemsTitle = input<string>('Itens processados');
	actionLabel = input<string>();
	actionCallback = input<() => void>();

	hasItems = computed(() => {
		const items = this.items();
		return !!items && items.length > 0;
	});
	hasAction = computed(() => !!this.actionLabel() && !!this.actionCallback());
}
