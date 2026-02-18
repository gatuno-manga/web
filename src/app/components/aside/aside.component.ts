import {
	Component,
	HostListener,
	OnInit,
	OnDestroy,
	Input,
	PLATFORM_ID,
	Inject,
	OnChanges,
	SimpleChanges,
	output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { IconsComponent } from '../icons/icons.component';

@Component({
	selector: 'app-aside',
	imports: [IconsComponent],
	templateUrl: './aside.component.html',
	styleUrl: './aside.component.scss',
})
export class AsideComponent implements OnInit, OnDestroy, OnChanges {
	@Input() position: 'left' | 'right' = 'right';
	@Input() topOffset = 60;
	@Input() readonly SWIPE_THRESHOLD = 300;
	@Input() readonly EDGE_THRESHOLD = 150;
	@Input() readonly ASIDE_WIDTH = 300;

	closed = output<void>();

	isOpen = false;
	private touchStartX = 0;
	private touchStartY = 0;
	private isDragging = false;
	public dragOffset = 0;
	private isBrowser: boolean;

	constructor(@Inject(PLATFORM_ID) platformId: object) {
		this.isBrowser = isPlatformBrowser(platformId);
	}

	ngOnInit() {
		if (this.isBrowser) {
			this.addTouchListeners();
		}
	}

	ngOnChanges(changes: SimpleChanges) {
		// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature obriga uso de bracket notation
		if (changes['position'] && !changes['position'].firstChange) {
			// Reset state when position changes
			this.isOpen = false;
			this.isDragging = false;
			this.dragOffset = 0;
		}
	}

	ngOnDestroy() {
		if (this.isBrowser) {
			this.removeTouchListeners();
		}
	}

	@HostListener('window:keydown', ['$event'])
	handleKeyboardEvent(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
			event.preventDefault();
			this.toggle();
		}
	}

	private addTouchListeners() {
		if (this.isBrowser && typeof document !== 'undefined') {
			document.addEventListener(
				'touchstart',
				this.handleTouchStart.bind(this),
				{ passive: true },
			);
			document.addEventListener(
				'touchmove',
				this.handleTouchMove.bind(this),
				{ passive: true },
			);
			document.addEventListener(
				'touchend',
				this.handleTouchEnd.bind(this),
				{ passive: true },
			);
		}
	}

	private removeTouchListeners() {
		if (this.isBrowser && typeof document !== 'undefined') {
			document.removeEventListener(
				'touchstart',
				this.handleTouchStart.bind(this),
			);
			document.removeEventListener(
				'touchmove',
				this.handleTouchMove.bind(this),
			);
			document.removeEventListener(
				'touchend',
				this.handleTouchEnd.bind(this),
			);
		}
	}

	private handleTouchStart(event: TouchEvent) {
		if (!this.isBrowser) return;

		this.touchStartX = event.touches[0].clientX;
		this.touchStartY = event.touches[0].clientY;
		const screenWidth = window.innerWidth;

		const isNearEdge =
			this.position === 'right'
				? this.touchStartX > screenWidth - this.EDGE_THRESHOLD
				: this.touchStartX < this.EDGE_THRESHOLD;

		if (isNearEdge || this.isOpen) {
			this.isDragging = true;
		}
	}

	private handleTouchMove(event: TouchEvent) {
		if (!this.isDragging) return;

		const currentX = event.touches[0].clientX;
		const deltaX = currentX - this.touchStartX;

		if (!this.isOpen) {
			if (this.position === 'right') {
				this.dragOffset = Math.max(
					-this.ASIDE_WIDTH,
					Math.min(0, deltaX),
				);
			} else {
				this.dragOffset = Math.max(
					0,
					Math.min(this.ASIDE_WIDTH, deltaX),
				);
			}
		} else {
			if (this.position === 'right') {
				this.dragOffset = Math.max(
					0,
					Math.min(this.ASIDE_WIDTH, deltaX),
				);
			} else {
				this.dragOffset = Math.max(
					-this.ASIDE_WIDTH,
					Math.min(0, deltaX),
				);
			}
		}
	}

	private handleTouchEnd(event: TouchEvent) {
		if (!this.isDragging) return;

		const touchEndX = event.changedTouches[0].clientX;
		const touchEndY = event.changedTouches[0].clientY;
		const deltaX = touchEndX - this.touchStartX;
		const deltaY = Math.abs(touchEndY - this.touchStartY);
		const screenWidth = window.innerWidth;

		this.isDragging = false;
		this.dragOffset = 0;

		if (this.position === 'right') {
			if (
				!this.isOpen &&
				this.touchStartX > screenWidth - this.EDGE_THRESHOLD &&
				deltaX < -this.SWIPE_THRESHOLD &&
				deltaY < this.SWIPE_THRESHOLD
			) {
				this.open();
				return;
			}

			if (
				this.isOpen &&
				deltaX > this.SWIPE_THRESHOLD &&
				deltaY < this.SWIPE_THRESHOLD
			) {
				this.close();
				return;
			}
		} else {
			if (
				!this.isOpen &&
				this.touchStartX < this.EDGE_THRESHOLD &&
				deltaX > this.SWIPE_THRESHOLD &&
				deltaY < this.SWIPE_THRESHOLD
			) {
				this.open();
				return;
			}

			if (
				this.isOpen &&
				deltaX < -this.SWIPE_THRESHOLD &&
				deltaY < this.SWIPE_THRESHOLD
			) {
				this.close();
				return;
			}
		}
	}

	toggle() {
		this.isOpen = !this.isOpen;
	}

	open() {
		this.isOpen = true;
	}

	close() {
		this.isOpen = false;
		this.closed.emit();
	}

	getDragTransform(): string {
		if (this.isDragging) {
			if (this.position === 'right') {
				if (!this.isOpen) {
					return `translateX(calc(100% + ${this.dragOffset}px))`;
				}
				return `translateX(${this.dragOffset}px)`;
			}
			if (!this.isOpen) {
				return `translateX(calc(-100% + ${this.dragOffset}px))`;
			}
			return `translateX(${this.dragOffset}px)`;
		}

		if (this.position === 'right') {
			return this.isOpen ? 'translateX(0)' : 'translateX(100%)';
		}
		return this.isOpen ? 'translateX(0)' : 'translateX(-100%)';
	}
}
