import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MetaDataService } from '@core/services/meta-data.service';
import { SearchService } from '@core/services/search.service';
import { NotificationSettingsService } from '@core/services/notification-settings.service';
import { SelectComponent } from '@ui/atoms/inputs/select/select.component';

@Component({
	selector: 'app-user-notifications',
	standalone: true,
	imports: [CommonModule, FormsModule, SelectComponent],
	templateUrl: './notifications.component.html',
	styleUrl: './notifications.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsSettingsComponent {
	private readonly metaService = inject(MetaDataService);
	private readonly searchService = inject(SearchService);
	public notificationSettings = inject(NotificationSettingsService);

	isListView = input<boolean>(false);
	private globalSearchQuery = this.searchService.query;

	showPage = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return 'notificações alertas avisos push mensagens'.includes(q);
	});

	toggleOptions = [
		{ value: 'true', label: 'Ativado' },
		{ value: 'false', label: 'Desativado' }
	];

	constructor() {
		this.setMetaData();
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Notificações',
			description: 'Controle como e quando o Gatuno fala com você',
		});
	}

	onAllNotificationsChange(value: string) {
		this.notificationSettings.toggleAllNotifications(value === 'true');
	}

	async onPushChange(value: string) {
		const enable = value === 'true';
		try {
			await this.notificationSettings.togglePushSubscription(enable);
		} catch (e) {
			console.error(e);
			// Em caso de erro, força a re-avaliação ou exibe erro
		}
	}
}
