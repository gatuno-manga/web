import { BreakpointObserver } from '@angular/cdk/layout';
import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	Inject,
	inject,
	PLATFORM_ID,
	signal,
} from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { HeaderStateService } from '@core/services/header-state.service';
import { HeaderComponent } from '@ui/organisms/header/header.component';
import { SideNavComponent } from './side-nav/side-nav.component';

@Component({
	selector: 'app-default-outlet',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [HeaderComponent, RouterModule, RouterOutlet, SideNavComponent],
	templateUrl: './default-outlet.component.html',
	styleUrl: './default-outlet.component.scss',
})
export class DefaultOutletComponent {
	protected headerState = inject(HeaderStateService);
	private breakpointObserver = inject(BreakpointObserver);

	sidebarOpen = signal(false);
	isLargeScreen = signal(false);

	constructor(@Inject(PLATFORM_ID) platformId: object) {
		this.isBrowser = isPlatformBrowser(platformId);
		this.breakpointObserver
			.observe(['(min-width: 1200px)'])
			.subscribe((result) => {
				this.isLargeScreen.set(result.matches);
			});
	}

	toggleSideNav() {
		this.sidebarOpen.update((v) => !v);
	}

	openSideNav() {
		this.sidebarOpen.set(true);
	}

	closeSideNav() {
		this.sidebarOpen.set(false);
	}
}
