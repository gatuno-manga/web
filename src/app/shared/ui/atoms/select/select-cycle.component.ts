import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { SelectItem } from './select.type';

@Component({
	selector: 'app-select-cycle',
	imports: [IconsComponent, NgClass],
	templateUrl: './select-cycle.component.html',
	styleUrl: './select-cycle.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectCycleComponent {
	items = input.required<SelectItem[]>();
	select = input<number>(0);
	disabled = input<boolean>(false);
	isCyclic = input<boolean>(true); // Flag para definir o comportamento

	onContainerClick() {
		if (this.disabled() || !this.isCyclic()) {
			return;
		}
		const currentIndex = this.select();
		const nextIndex = (currentIndex + 1) % this.items().length;
		this.items()[nextIndex].checked();
	}

	onIconClick(event: Event, index: number) {
		if (this.disabled()) {
			return;
		}
		if (!this.isCyclic()) {
			event.stopPropagation();
			this.items()[index].checked();
		}
	}
}
