import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	OnInit,
	signal,
	viewChild,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { AppTheme, ThemeService } from '@core/services/theme.service';
import { UserTokenService } from '@core/services/user-token.service';
import { UserService } from '@core/services/user.service';
import { SensitiveContentResponse } from '@models/book.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { AsideComponent } from '@ui/organisms/aside/aside.component';

export type MenuView = 'main' | 'theme' | 'filter';

@Component({
	selector: 'app-user-menu',
	standalone: true,
	imports: [CommonModule, RouterModule, IconsComponent, AsideComponent],
	templateUrl: './user-menu.organism.html',
	styleUrl: './user-menu.organism.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuOrganismComponent implements OnInit {
	private breakpointObserver = inject(BreakpointObserver);
	private userService = inject(UserService);
	private userTokenService = inject(UserTokenService);
	private themeService = inject(ThemeService);
	private authService = inject(AuthService);
	private sensitiveContentService = inject(SensitiveContentService);
	private elementRef = inject(ElementRef);

	isLargeScreen = signal(false);
	isOpen = signal(false);
	currentView = signal<MenuView>('main');

	aside = viewChild<AsideComponent>(AsideComponent);

	isLoggedIn = this.userTokenService.hasValidAccessTokenSignal;
	userProfile = this.userService.profileSignal;
	currentTheme = this.themeService.currentTheme;

	availableFilters = signal<SensitiveContentResponse[]>([]);
	activeFilters = this.sensitiveContentService.allowContentSignal;

	constructor() {
		this.breakpointObserver
			.observe(['(min-width: 768px)'])
			.subscribe((result) => {
				this.isLargeScreen.set(result.matches);
			});
	}

	ngOnInit() {
		this.sensitiveContentService.getSensitiveContent().subscribe((filters) => {
			this.availableFilters.set(filters);
		});
	}

	toggle() {
		this.isOpen.update((v) => !v);
	}

	close() {
		this.isOpen.set(false);
		setTimeout(() => this.currentView.set('main'), 300);
	}

	setView(view: MenuView) {
		this.currentView.set(view);
	}

	backToMain() {
		this.currentView.set('main');
	}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent) {
		if (this.isLargeScreen() && this.isOpen()) {
			const target = event.target as HTMLElement;
			if (!this.elementRef.nativeElement.contains(target)) {
				this.close();
			}
		}
	}

	setTheme(theme: AppTheme) {
		this.themeService.setTheme(theme);
	}

	toggleFilter(filterName: string) {
		const current = this.activeFilters();
		const updated = current.includes(filterName)
			? current.filter((f) => f !== filterName)
			: [...current, filterName];
		this.sensitiveContentService.setContentAllow(updated);
	}

	isFilterActive(filterName: string): boolean {
		return this.activeFilters().includes(filterName);
	}

	logout() {
		this.authService.logout().subscribe();
		this.close();
	}
}
