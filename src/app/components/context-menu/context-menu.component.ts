import { Component, ElementRef, HostListener, inject, ViewChild, effect, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ContextMenuService } from '../../service/context-menu.service';
import { IconsComponent } from '../icons/icons.component';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule, IconsComponent],
  templateUrl: './context-menu.component.html',
  styleUrl: './context-menu.component.scss'
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
    if (this.state().visible && !this.elementRef.nativeElement.contains(event.target)) {
      this.contextMenuService.close();
    }
  }

  closeMenu() {
    this.contextMenuService.close();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onWindowEvents() {
    if (this.state().visible) {
      // If we scroll, we want to check if it's still in view or close it?
      // User said "aconpanhe" (follow) -> handled by position: absolute
      // "quando sair da tela ele desapareça" -> disappear when off screen.
      // Since it's absolute, it scrolls with page. If it goes off viewport, it disappears naturally.
      // Do we need to force close it?
      // Many context menus close on scroll. But if the user wants it to follow the element...
      // If I scroll the page, the context menu moves up/down.
      // If I scroll fast, it might go off screen.
      // If the user meant "close it if I scroll", then I should call close() here.
      // But "acompanhe" suggests it should stick to the anchor.
      // So I will NOT close on scroll, just let it move with the document.

      // However, re-adjust position if window resizes is good.
    }
  }

  onItemClick(event: MouseEvent, item: any) {
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
