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
import { IconsComponent } from '../icons/icons.component';
import { ThemeService } from '../../service/theme.service';
import { UserTokenService } from '../../service/user-token.service';

@Component({
	selector: 'app-header',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterModule, IconsComponent],
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

	isDarkTheme = computed(() =>
		['dark', 'true-dark'].includes(this.themeService.currentTheme()),
	);
	isLoggedIn = this.userTokenService.hasValidAccessTokenSignal;
	isAdmin = this.userTokenService.isAdminSignal;
}
