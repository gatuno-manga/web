import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { MetaDataService } from '@core/services/meta-data.service';
import { OverlayNotificationComponent } from '@ui/molecules/notification/overlay-notification/overlay-notification.component';
import { ContextMenuComponent } from '@ui/organisms/context-menu/context-menu.component';
import { ThemeSetupModalComponent } from '@ui/organisms/theme-setup-modal/theme-setup-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OverlayNotificationComponent, ContextMenuComponent, ThemeSetupModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  public themeService = inject(ThemeService);
  public sensitiveContentService = inject(SensitiveContentService);
  public metadata = inject(MetaDataService);

  ngOnInit() {
    this.metadata.initDefaultMeta();
  }
}
