import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { IconsComponent } from '../icons/icons.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-aside',
  imports: [IconsComponent, CommonModule],
  templateUrl: './aside.component.html',
  styleUrl: './aside.component.scss'
})
export class AsideComponent implements OnInit, OnDestroy {
  isOpen = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private readonly SWIPE_THRESHOLD = 300;
  private readonly EDGE_THRESHOLD = 150;
  private isDragging = false;
  public dragOffset = 0;

  ngOnInit() {
    this.addTouchListeners();
  }

  ngOnDestroy() {
    this.removeTouchListeners();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      this.toggle();
    }
  }

  private addTouchListeners() {
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  private removeTouchListeners() {
    document.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    document.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    document.removeEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  private handleTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    const screenWidth = window.innerWidth;

    if (this.touchStartX > (screenWidth - this.EDGE_THRESHOLD) || this.isOpen) {
      this.isDragging = true;
    }
  }

  private handleTouchMove(event: TouchEvent) {
    if (!this.isDragging) return;

    const currentX = event.touches[0].clientX;
    const deltaX = currentX - this.touchStartX;

    if (!this.isOpen) {
      this.dragOffset = Math.max(-300, Math.min(0, deltaX));
    } else {
      this.dragOffset = Math.max(0, Math.min(300, deltaX));
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

    if (
      !this.isOpen &&
      this.touchStartX > (screenWidth - this.EDGE_THRESHOLD) &&
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
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  getDragTransform(): string {
    if (this.isDragging) {
      if (!this.isOpen) {
        return `translateX(calc(100% + ${this.dragOffset}px))`;
      } else {
        return `translateX(${this.dragOffset}px)`;
      }
    }
    return this.isOpen ? 'translateX(0)' : 'translateX(100%)';
  }
}
