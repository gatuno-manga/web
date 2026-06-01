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
import { ThemeService } from '@core/services/theme.service';
import { UserService } from '@core/services/user.service';
import { UserTokenService } from '@core/services/user-token.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { SearchMoleculeComponent } from '@ui/molecules/search/search.molecule';
import { UserMenuOrganismComponent } from '@ui/organisms/user-menu/user-menu.organism';

@Component({
	selector: 'app-header',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		RouterModule,
		IconsComponent,
		SearchMoleculeComponent,
		UserMenuOrganismComponent,
	],
	templateUrl: './header.component.html',
	styleUrl: './header.component.scss',
})
export class HeaderComponent {
	private location = inject(Location);
	private themeService = inject(ThemeService);
	private userTokenService = inject(UserTokenService);
	private userService = inject(UserService);

	toggleMenu = output<void>();
	hideLogo = input<boolean>(false);

	backPage() {
		this.location.back();
	}

	isDarkTheme = computed(() =>
		['dark', 'true-dark'].includes(this.themeService.currentTheme()),
	);
	isLoggedIn = this.userTokenService.hasValidAccessTokenSignal;
	isAdmin = this.userTokenService.isAdminSignal;
	userProfile = this.userService.profileSignal;
}
