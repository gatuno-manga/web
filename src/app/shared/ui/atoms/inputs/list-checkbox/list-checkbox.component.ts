import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ListCheckboxItem } from './list-checkbox.type';

@Component({
	selector: 'app-list-checkbox',
	imports: [],
	templateUrl: './list-checkbox.component.html',
	styleUrl: './list-checkbox.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListCheckboxComponent {
	items = input<ListCheckboxItem[]>([]);

	OnItemChange(item: ListCheckboxItem) {
		item.checked = !item.checked;
	}
}
