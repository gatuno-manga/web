import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IconButtonComponent } from '@ui/atoms/icon-button/icon-button.component';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { NotificationService } from '@core/services/notification.service';

@Component({
	selector: 'app-notification-menu',
	standalone: true,
	imports: [IconButtonComponent, IconsComponent],
	templateUrl: './notification-menu.organism.html',
	styleUrl: './notification-menu.organism.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationMenuOrganismComponent {
	private notificationService = inject(NotificationService);

	isOpen = signal(false);
	
	notifications = this.notificationService.history;
	unreadCount = this.notificationService.unreadCount;

	toggleMenu(event: Event) {
		event.stopPropagation();
		this.isOpen.update((v) => {
			const willOpen = !v;
			if (willOpen && this.unreadCount() > 0) {
				this.notificationService.markAllAsRead();
			}
			return willOpen;
		});
	}
}
