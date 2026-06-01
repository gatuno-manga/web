import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AppTheme, ThemeService } from '@core/services/theme.service';
import { UserTokenService } from '@core/services/user-token.service';
import { UserService } from '@core/services/user.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { AsideComponent } from '@ui/organisms/aside/aside.component';

@Component({
	selector: 'app-user-menu',
	standalone: true,
	imports: [CommonModule, RouterModule, IconsComponent, AsideComponent],
	templateUrl: './user-menu.organism.html',
	styleUrl: './user-menu.organism.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuOrganismComponent {
	private breakpointObserver = inject(BreakpointObserver);
	private userService = inject(UserService);
	private userTokenService = inject(UserTokenService);
	private themeService = inject(ThemeService);
	private authService = inject(AuthService);
	private elementRef = inject(ElementRef);

	isLargeScreen = signal(false);
	isOpen = signal(false);

	aside = viewChild<AsideComponent>(AsideComponent);

	isLoggedIn = this.userTokenService.hasValidAccessTokenSignal;
	userProfile = this.userService.profileSignal;
	currentTheme = this.themeService.currentTheme;

	constructor() {
		this.breakpointObserver
			.observe(['(min-width: 768px)'])
			.subscribe((result) => {
				this.isLargeScreen.set(result.matches);
				if (this.isOpen()) this.close();
			});
	}

	toggle() {
		if (this.isLargeScreen()) {
			this.isOpen.update((v) => !v);
		} else {
			this.aside()?.toggle();
		}
	}

	close() {
		this.isOpen.set(false);
		this.aside()?.close();
	}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent) {
		if (this.isLargeScreen() && this.isOpen()) {
			const target = event.target as HTMLElement;
			// Don't close if clicking inside the component
			if (!this.elementRef.nativeElement.contains(target)) {
				this.close();
			}
		}
	}

	setTheme(theme: AppTheme) {
		this.themeService.setTheme(theme);
	}

	logout() {
		this.authService.logout().subscribe();
		this.close();
	}
}
