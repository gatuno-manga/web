import { Component, inject } from '@angular/core';
import { ThemeService } from '../../service/theme.service';
import { IconsComponent } from '../icons/icons.component';


@Component({
  selector: 'app-theme-toggle',
  imports: [IconsComponent],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss'
})
export class ThemeToggleComponent {
  public themeService = inject(ThemeService);

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
