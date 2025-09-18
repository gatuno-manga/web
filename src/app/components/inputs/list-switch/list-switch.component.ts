import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SwitchComponent } from '../switch/switch.component';

@Component({
  selector: 'app-list-switch',
  imports: [SwitchComponent],
  templateUrl: './list-switch.component.html',
  styleUrl: './list-switch.component.scss'
})
export class ListSwitchComponent {
  @Input() items: { id: string; name: string }[] = [];
  @Input() selectedItems: string[] = [];
  @Output() toggleItem = new EventEmitter<{ id: string; name: string }>();

  isItemSelected(item: { id: string; name: string }): boolean {
    return this.selectedItems.includes(item.name);
  }

  onItemToggle(item: { id: string; name: string }): void {
    this.toggleItem.emit(item);
  }
}
