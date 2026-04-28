import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './service/theme.service';
import { SensitiveContentService } from './service/sensitive-content.service';
import { MetaDataService } from './service/meta-data.service';
import { OverlayNotificationComponent } from './components/notification/overlay-notification/overlay-notification.component';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { ThemeSetupModalComponent } from './components/theme-setup-modal/theme-setup-modal.component';

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
