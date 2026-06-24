import { Component, forwardRef, model } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

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
	styleUrl: './switch.component.scss',
})
export class SwitchComponent implements ControlValueAccessor {
	value = model<boolean>(false);
	disabled = model<boolean>(false);

	onChange: any = () => {};
	onTouched: any = () => {};

	onSwitchChange(event: Event): void {
		const input = event.target as HTMLInputElement;
		const newValue = input.checked;
		this.value.set(newValue);
		this.onChange(newValue);
		this.onTouched();
	}

	writeValue(value: any): void {
		this.value.set(!!value);
	}

	registerOnChange(fn: any): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: any): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled.set(isDisabled);
	}
}
