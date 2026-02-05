import { Component, input, output } from '@angular/core';
import { SwitchComponent } from '../switch/switch.component';

@Component({
  selector: 'app-list-switch',
  standalone: true,
  imports: [SwitchComponent],
  templateUrl: './list-switch.component.html',
  styleUrl: './list-switch.component.scss'
})
export class ListSwitchComponent {
  items = input<{ id: string; name: string }[]>([]);
  selectedItems = input<string[]>([]);
  toggleItem = output<{ id: string; name: string }>();

  isItemSelected(item: { id: string; name: string }): boolean {
    return this.selectedItems().includes(item.name);
  }

  onItemToggle(item: { id: string; name: string }): void {
    this.toggleItem.emit(item);
  }
}
