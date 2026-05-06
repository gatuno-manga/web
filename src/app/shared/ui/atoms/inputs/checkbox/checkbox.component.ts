import { Component, forwardRef, Input } from '@angular/core';
import { CheckboxControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-checkbox',
  imports: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.scss'
})
export class CheckboxComponent extends CheckboxControlValueAccessor {
  @Input() value: boolean = false;
  @Input() disabled: boolean = false;

  onCheckboxChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = input.checked;
    if (this.onChange) {
      this.onChange(this.value);
    }
    if (this.onTouched) {
      this.onTouched();
    }
  }
}
