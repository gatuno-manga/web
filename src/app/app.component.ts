import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MetaDataService } from '@core/services/meta-data.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { ThemeService } from '@core/services/theme.service';
import { OverlayNotificationComponent } from '@ui/molecules/notification/overlay-notification/overlay-notification.component';
import { ContextMenuComponent } from '@ui/organisms/context-menu/context-menu.component';
import { ThemeSetupModalComponent } from '@ui/organisms/theme-setup-modal/theme-setup-modal.component';

@Component({
	selector: 'app-root',
	imports: [
		RouterOutlet,
		OverlayNotificationComponent,
		ContextMenuComponent,
		ThemeSetupModalComponent,
	],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
	public themeService = inject(ThemeService);
	public sensitiveContentService = inject(SensitiveContentService);
	public metadata = inject(MetaDataService);

	ngOnInit() {
		this.metadata.initDefaultMeta();
	}
}
