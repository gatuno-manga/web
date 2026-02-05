import { Component, input, output, forwardRef } from '@angular/core';
import { CheckboxControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-switch',
  standalone: true,
  imports: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SwitchComponent),
      multi: true,
    },
  ],
  templateUrl: './switch.component.html',
  styleUrl: './switch.component.scss'
})
export class SwitchComponent extends CheckboxControlValueAccessor {
  value = input<boolean>(false);
  disabled = input<boolean>(false);
  valueChange = output<boolean>();

  onSwitchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newValue = input.checked;
    this.valueChange.emit(newValue);
    if (this.onChange) {
      this.onChange(newValue);
    }
    if (this.onTouched) {
      this.onTouched();
    }
  }
}
