import { isPlatformBrowser } from '@angular/common';
import {
	Component,
	computed,
	HostListener,
	inject,
	input,
	OnDestroy,
	OnInit,
	output,
	PLATFORM_ID,
	signal,
} from '@angular/core';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-aside',
	imports: [IconsComponent],
	templateUrl: './aside.component.html',
	styleUrl: './aside.component.scss',
})
export class AsideComponent implements OnInit, OnDestroy {
	position = input<'left' | 'right'>('right');
	topOffset = input<number>(60);
	swipeThreshold = input<number>(300, { alias: 'SWIPE_THRESHOLD' });
	edgeThreshold = input<number>(150, { alias: 'EDGE_THRESHOLD' });
	asideWidth = input<number>(400, { alias: 'ASIDE_WIDTH' });

	closed = output<void>();

	isOpen = signal(false);
	private touchStartX = 0;
	private touchStartY = 0;
	private isDragging = signal(false);
	public dragOffset = signal(0);
	private isBrowser: boolean;

	constructor() {
		const platformId = inject(PLATFORM_ID);
		this.isBrowser = isPlatformBrowser(platformId);
	}

	ngOnInit() {
		if (this.isBrowser) {
			this.addTouchListeners();
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
			this.position() === 'right'
				? this.touchStartX > screenWidth - this.edgeThreshold()
				: this.touchStartX < this.edgeThreshold();

		if (isNearEdge || this.isOpen()) {
			this.isDragging.set(true);
		}
	}

	private handleTouchMove(event: TouchEvent) {
		if (!this.isDragging()) return;

		const currentX = event.touches[0].clientX;
		const deltaX = currentX - this.touchStartX;

		if (!this.isOpen()) {
			if (this.position() === 'right') {
				this.dragOffset.set(
					Math.max(-this.asideWidth(), Math.min(0, deltaX)),
				);
			} else {
				this.dragOffset.set(
					Math.max(0, Math.min(this.asideWidth(), deltaX)),
				);
			}
		} else {
			if (this.position() === 'right') {
				this.dragOffset.set(
					Math.max(0, Math.min(this.asideWidth(), deltaX)),
				);
			} else {
				this.dragOffset.set(
					Math.max(-this.asideWidth(), Math.min(0, deltaX)),
				);
			}
		}
	}

	private handleTouchEnd(event: TouchEvent) {
		if (!this.isDragging()) return;

		const touchEndX = event.changedTouches[0].clientX;
		const touchEndY = event.changedTouches[0].clientY;
		const deltaX = touchEndX - this.touchStartX;
		const deltaY = Math.abs(touchEndY - this.touchStartY);
		const screenWidth = window.innerWidth;

		this.isDragging.set(false);
		this.dragOffset.set(0);

		if (this.position() === 'right') {
			if (
				!this.isOpen() &&
				this.touchStartX > screenWidth - this.edgeThreshold() &&
				deltaX < -this.swipeThreshold() &&
				deltaY < this.swipeThreshold()
			) {
				this.open();
				return;
			}

			if (
				this.isOpen() &&
				deltaX > this.swipeThreshold() &&
				deltaY < this.swipeThreshold()
			) {
				this.close();
				return;
			}
		} else {
			if (
				!this.isOpen() &&
				this.touchStartX < this.edgeThreshold() &&
				deltaX > this.swipeThreshold() &&
				deltaY < this.swipeThreshold()
			) {
				this.open();
				return;
			}

			if (
				this.isOpen() &&
				deltaX < -this.swipeThreshold() &&
				deltaY < this.swipeThreshold()
			) {
				this.close();
				return;
			}
		}
	}

	toggle() {
		this.isOpen.update((v) => !v);
	}

	open() {
		this.isOpen.set(true);
	}

	close() {
		this.isOpen.set(false);
		this.closed.emit();
	}

	dragTransform = computed(() => {
		const isDragging = this.isDragging();
		const position = this.position();
		const isOpen = this.isOpen();
		const dragOffset = this.dragOffset();

		if (isDragging) {
			if (position === 'right') {
				if (!isOpen) {
					return `translateX(calc(100% + ${dragOffset}px))`;
				}
				return `translateX(${dragOffset}px)`;
			}
			if (!isOpen) {
				return `translateX(calc(-100% + ${dragOffset}px))`;
			}
			return `translateX(${dragOffset}px)`;
		}

		if (position === 'right') {
			return isOpen ? 'translateX(0)' : 'translateX(100%)';
		}
		return isOpen ? 'translateX(0)' : 'translateX(-100%)';
	});
}
