import { ChangeDetectionStrategy, Component, forwardRef, input, model } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

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
	styleUrl: './checkbox.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxComponent implements ControlValueAccessor {
	value = model<boolean>(false);
	disabled = model<boolean>(false);
	indeterminate = input<boolean>(false);

	onChange: (value: boolean) => void = () => {};
	onTouched: () => void = () => {};

	onCheckboxChange(event: Event): void {
		const input = event.target as HTMLInputElement;
		const newValue = input.checked;
		this.value.set(newValue);
		this.onChange(newValue);
		this.onTouched();
	}

	writeValue(value: boolean | null | undefined): void {
		this.value.set(!!value);
	}

	registerOnChange(fn: (value: boolean) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled.set(isDisabled);
	}
}
