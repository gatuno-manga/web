import { Component, Input } from '@angular/core';
import { ListCheckboxItem } from './list-checkbox.type';

@Component({
  selector: 'app-list-checkbox',
  imports: [],
  templateUrl: './list-checkbox.component.html',
  styleUrl: './list-checkbox.component.scss'
})
export class ListCheckboxComponent {
  @Input() items: ListCheckboxItem[] = [];

  OnItemChange(item: ListCheckboxItem) {
    item.checked = !item.checked;
  }
}
