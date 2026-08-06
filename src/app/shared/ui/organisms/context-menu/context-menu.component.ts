import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	effect,
	HostListener,
	inject,
	PLATFORM_ID,
	ViewChild,
} from '@angular/core';
import { ContextMenuService } from '@core/services/context-menu.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-context-menu',
	standalone: true,
	imports: [CommonModule, IconsComponent],
	templateUrl: './context-menu.component.html',
	styleUrl: './context-menu.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenuComponent {
	private contextMenuService = inject(ContextMenuService);
	private elementRef = inject(ElementRef);
	private platformId = inject(PLATFORM_ID);

	state = this.contextMenuService.state;

	@ViewChild('menu') menuElement!: ElementRef<HTMLDivElement>;

	constructor() {
		effect(() => {
			if (this.state().visible) {
				// Logic to keep menu within viewport bounds could go here
				// We need to wait for render to get dimensions
				setTimeout(() => this.adjustPosition(), 0);
				this.lockScroll();
			} else {
				this.unlockScroll();
			}
		});
	}

	private lockScroll(): void {
		if (isPlatformBrowser(this.platformId)) {
			document.body.style.overflow = 'hidden';
		}
	}

	private unlockScroll(): void {
		if (isPlatformBrowser(this.platformId)) {
			document.body.style.overflow = '';
		}
	}

	@HostListener('document:click', ['$event'])
	@HostListener('document:contextmenu', ['$event'])
	onDocumentClick(event: MouseEvent) {
		if (
			this.state().visible &&
			!this.elementRef.nativeElement.contains(event.target)
		) {
			this.contextMenuService.close();
		}
	}

	closeMenu() {
		this.contextMenuService.close();
	}

	onItemClick(
		event: MouseEvent,
		item: { disabled?: boolean; type?: string; action?: () => void },
	) {
		event.stopPropagation();
		if (item.disabled || item.type === 'separator') return;

		if (item.action) {
			item.action();
		}
		this.contextMenuService.close();
	}

	private adjustPosition() {
		if (!this.menuElement) return;

		const menu = this.menuElement.nativeElement;
		const { x, y } = this.state();
		const { innerWidth, innerHeight } = window;
		const { offsetWidth, offsetHeight } = menu;

		let newX = x;
		let newY = y;

		// Check right edge
		if (x + offsetWidth > innerWidth) {
			newX = innerWidth - offsetWidth - 10;
		}

		// Check bottom edge
		if (y + offsetHeight > innerHeight) {
			newY = innerHeight - offsetHeight - 10;
		}

		menu.style.left = `${newX}px`;
		menu.style.top = `${newY}px`;
	}
}
