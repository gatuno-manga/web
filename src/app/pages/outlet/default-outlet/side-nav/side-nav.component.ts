import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	output,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';
import { UserTokenService } from '@core/services/user-token.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

interface NavItem {
	label: string;
	icon: string;
	route: string;
}

interface NavGroup {
	items: NavItem[];
}

@Component({
	selector: 'app-side-nav',
	standalone: true,
	imports: [RouterModule, IconsComponent],
	templateUrl: './side-nav.component.html',
	styleUrl: './side-nav.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavComponent {
	close = output<void>();
	private themeService = inject(ThemeService);
	private userTokenService = inject(UserTokenService);

	isDarkTheme = computed(() => this.themeService.currentTheme() === 'dark');
	isLoggedIn = this.userTokenService.hasValidAccessTokenSignal;
	isAdmin = this.userTokenService.isAdminSignal;

	get navGroups(): NavGroup[] {
		return [
			{
				items: [
					{ label: 'Home', icon: 'grid', route: '/' },
					{ label: 'Livros', icon: 'book', route: '/books' },
					this.isLoggedIn()
						? { label: 'Perfil', icon: 'user', route: '/user' }
						: {
								label: 'Entrar',
								icon: 'user',
								route: '/auth/login',
							},
				],
			},
			{
				items: [
					{
						label: 'Ultimas leituras',
						icon: 'clock',
						route: '/latest-reads',
					},
					{ label: 'Livro aleatório', icon: 'shuffle', route: '#' },
				],
			},
			...(this.isAdmin()
				? [
						{
							items: [
								{
									label: 'Dashboard',
									icon: 'grid',
									route: '/dashboard',
								},
							],
						},
					]
				: []),
		];
	}

	onClose() {
		this.close.emit();
	}
}
