import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MetaDataService } from '@core/services/meta-data.service';
import { UserTokenService } from '@core/services/user-token.service';
import { AppearanceComponent } from '../appearance/appearance.component';
import { FilterComponent } from '../filter/filter.component';
import { ProfileComponent } from '../profile/profile.component';
import { ReadingsComponent } from '../readings/readings.component';
import { SecurityComponent } from '../security/security.component';
import { NotificationsSettingsComponent } from '../notifications/notifications.component';

@Component({
	selector: 'app-all-settings',
	standalone: true,
	imports: [
		FilterComponent,
		AppearanceComponent,
		ReadingsComponent,
		ProfileComponent,
		SecurityComponent,
		NotificationsSettingsComponent,
	],
	templateUrl: './all-settings.component.html',
	styleUrl: './all-settings.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllSettingsComponent {
	private readonly metaService = inject(MetaDataService);
	public readonly userTokenService = inject(UserTokenService);

	constructor() {
		this.metaService.setMetaData({
			title: 'Todas as Configurações',
			description:
				'Veja e gerencie todas as suas configurações em um só lugar.',
		});
	}
}
