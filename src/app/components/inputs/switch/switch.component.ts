import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { CheckboxControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-switch',
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
  @Input() value: boolean = false;
  @Input() disabled: boolean = false;
  @Output() valueChange = new EventEmitter<boolean>();

  onSwitchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = input.checked;
    this.valueChange.emit(this.value);
    if (this.onChange) {
      this.onChange(this.value);
    }
    if (this.onTouched) {
      this.onTouched();
    }
  }
}
