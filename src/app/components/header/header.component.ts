import { Location } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { IconsComponent } from '../icons/icons.component';
import { ThemeService } from '../../service/theme.service';
import { UserTokenService } from '../../service/user-token.service';

@Component({
	selector: 'app-header',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterModule, IconsComponent, ThemeToggleComponent],
	templateUrl: './header.component.html',
	styleUrl: './header.component.scss',
})
export class HeaderComponent {
	private location = inject(Location);
	private themeService = inject(ThemeService);
	private userTokenService = inject(UserTokenService);

	toggleMenu = output<void>();
	hideLogo = input<boolean>(false);

	backPage() {
		this.location.back();
	}

	isDarkTheme = computed(() => this.themeService.currentTheme() === 'dark');
	isLoggedIn = this.userTokenService.hasValidAccessTokenSignal;
	isAdmin = this.userTokenService.isAdminSignal;
}
