import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
	OnInit,
	OnDestroy,
	PLATFORM_ID,
	Inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HeaderComponent } from '../../../components/header/header.component';
import { RouterModule, RouterOutlet } from '@angular/router';
import { HeaderStateService } from '../../../service/header-state.service';
import { SideNavComponent } from './side-nav/side-nav.component';
import { BreakpointObserver } from '@angular/cdk/layout';

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
	private isBrowser: boolean;

	sidebarOpen = signal(false);
	isLargeScreen = signal(false);

	private readonly SWIPE_THRESHOLD = 60;
	private readonly EDGE_THRESHOLD = 40;
	private touchStartX = 0;
	private touchStartY = 0;

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
