import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	inject,
	signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '@core/services/notification.service';
import { IconButtonComponent } from '@ui/atoms/icon-button/icon-button.component';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { AsideComponent } from '@ui/organisms/aside/aside.component';

@Component({
	selector: 'app-notification-menu',
	standalone: true,
	imports: [
		CommonModule,
		IconButtonComponent,
		IconsComponent,
		AsideComponent,
	],
	templateUrl: './notification-menu.organism.html',
	styleUrl: './notification-menu.organism.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationMenuOrganismComponent {
	private notificationService = inject(NotificationService);
	private breakpointObserver = inject(BreakpointObserver);
	private elementRef = inject(ElementRef);

	isLargeScreen = signal(false);
	isOpen = signal(false);

	notifications = this.notificationService.history;
	unreadCount = this.notificationService.unreadCount;

	private destroyRef = inject(DestroyRef);

	constructor() {
		this.breakpointObserver
			.observe(['(min-width: 768px)'])
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((result) => {
				this.isLargeScreen.set(result.matches);
			});
	}

	toggleMenu(event: Event) {
		event.stopPropagation();
		this.isOpen.update((v) => {
			const willOpen = !v;
			if (willOpen && this.unreadCount() > 0) {
				this.notificationService.markAllAsRead();
			}
			return willOpen;
		});
	}

	close() {
		this.isOpen.set(false);
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
}
