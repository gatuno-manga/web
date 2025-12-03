import { Location, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { IconsComponent } from '../icons/icons.component';
import { ThemeService } from '../../service/theme.service';
import { UserTokenService } from '../../service/user-token.service';

@Component({
  selector: 'app-header',
  imports: [
    RouterModule,
    IconsComponent,
    ThemeToggleComponent,
    NgClass
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private location = inject(Location);
  private themeService = inject(ThemeService);
  private userTokenService = inject(UserTokenService);

  constructor() {}

  backPage() {
    this.location.back();
  }

  isDarkTheme(): boolean {
    return this.themeService.currentTheme() === 'dark';
  }

  isloggedIn = this.userTokenService.hasValidAccessTokenSignal;

  isAdmin = this.userTokenService.isAdminSignal;

}
