import { Component, inject } from '@angular/core';
import { ThemeService } from '../../service/theme.service';
import { IconsComponent } from '../icons/icons.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-theme-toggle',
  imports: [IconsComponent, NgIf],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss'
})
export class ThemetToggleComponent {
  public themeService = inject(ThemeService);

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
