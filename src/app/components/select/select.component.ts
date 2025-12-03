import { Component, Input } from '@angular/core';
import { SelectItem } from './select.type';
import { IconsComponent } from '../icons/icons.component';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-select',
  imports: [IconsComponent, NgClass],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss'
})
export class SelectComponent {
  @Input() items!: SelectItem[];
  @Input() select = 0;
  @Input() disabled: boolean = false;

  onSelect() {
    if (this.disabled) {
      return;
    }
    this.select = (this.select + 1) % this.items.length;
    this.items[this.select].checked();
  }
}
