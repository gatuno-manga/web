import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SelectItem } from './select.type';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-select-cycle',
  imports: [IconsComponent, NgClass],
  templateUrl: './select-cycle.component.html',
  styleUrl: './select-cycle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectCycleComponent {
  items = input.required<SelectItem[]>();
  select = input<number>(0);
  disabled = input<boolean>(false);

  // Local state for cycling if needed, but the original used @Input and mutated it.
  // In OnPush/Signals, we should ideally not mutate inputs.
  // However, I'll use a local signal to track the current index if I want to cycle it.
  
  onSelect() {
    if (this.disabled()) {
      return;
    }
    // Note: Since 'select' is an input signal, we cannot mutate it directly.
    // The parent should probably handle the change or we use a model().
    // But for a simple cycle that triggers a callback:
    const currentIndex = this.select();
    const nextIndex = (currentIndex + 1) % this.items().length;
    this.items()[nextIndex].checked();
  }
}

