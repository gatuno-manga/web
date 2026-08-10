import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	effect,
	inject,
	PLATFORM_ID,
	ViewChild,
} from '@angular/core';
import { BodyScrollService } from '@core/services/body-scroll.service';
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
	private bodyScrollService = inject(BodyScrollService);
	private elementRef = inject(ElementRef);
	private platformId = inject(PLATFORM_ID);
	private destroyRef = inject(DestroyRef);

	state = this.contextMenuService.state;

	@ViewChild('menu') menuElement!: ElementRef<HTMLDivElement>;

	constructor() {
		effect(() => {
			if (this.state().visible) {
				// Logic to keep menu within viewport bounds could go here
				// We need to wait for render to get dimensions
				if (isPlatformBrowser(this.platformId)) {
					requestAnimationFrame(() => this.adjustPosition());
				}
				this.bodyScrollService.disableScroll();
			} else {
				this.bodyScrollService.enableScroll();
			}
		});

		// Registrado fora do binding do Angular: num app zoneless, um
		// @HostListener dispararia um ciclo de change detection global a
		// cada clique da aplicação, mesmo com o menu fechado.
		if (isPlatformBrowser(this.platformId)) {
			const handler = (event: Event) =>
				this.onDocumentClick(event as MouseEvent);
			document.addEventListener('click', handler);
			document.addEventListener('contextmenu', handler);
			this.destroyRef.onDestroy(() => {
				document.removeEventListener('click', handler);
				document.removeEventListener('contextmenu', handler);
			});
		}
	}

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
