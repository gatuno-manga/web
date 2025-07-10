import { Location, NgClass } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule, RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { IconsComponent } from '../icons/icons.component';
import { ThemeService } from '../../service/theme.service';

@Component({
  selector: 'app-header',
  imports: [RouterModule, IconsComponent, ThemeToggleComponent, NgClass],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  constructor(
    private location: Location,
    private themeService: ThemeService,
  ) {}

  backPage() {
    this.location.back();
  }

  isDarkTheme(): boolean {
    return this.themeService.currentTheme() === 'dark';
  }

}
