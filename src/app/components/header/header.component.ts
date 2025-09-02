import { Location, NgClass, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule, RouterOutlet } from '@angular/router';
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
    NgClass,
    NgIf
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  constructor(
    private readonly location: Location,
    private readonly themeService: ThemeService,
    private readonly userTokenService: UserTokenService,
  ) {}

  backPage() {
    this.location.back();
  }

  isDarkTheme(): boolean {
    return this.themeService.currentTheme() === 'dark';
  }

  isloggedIn(): boolean {
    return this.userTokenService.hasToken;
  }

  isAdmin(): boolean {
    return this.userTokenService.isAdmin();
  }

}
