import { Injectable, signal } from '@angular/core';
import { ContextMenuItem, ContextMenuState } from '../models/context-menu.models';

@Injectable({
  providedIn: 'root'
})
export class ContextMenuService {
  // Using signal for state management as it's more modern angular
  state = signal<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: []
  });

  open(event: MouseEvent, items: ContextMenuItem[]) {
    event.preventDefault();
    event.stopPropagation();

    this.state.set({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      items
    });
  }

  close() {
    this.state.update(s => ({ ...s, visible: false }));
  }
}
