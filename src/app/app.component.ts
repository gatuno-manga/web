import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './service/theme.service';
import { SensitiveContentService } from './service/sensitive-content.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
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
