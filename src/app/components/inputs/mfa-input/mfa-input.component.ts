import {
	Component,
	ElementRef,
	forwardRef,
	QueryList,
	ViewChildren,
	ChangeDetectionStrategy,
} from '@angular/core';
import {
	ControlValueAccessor,
	NG_VALUE_ACCESSOR,
	ReactiveFormsModule,
} from '@angular/forms';

@Component({
	selector: 'app-mfa-input',
	standalone: true,
	imports: [ReactiveFormsModule],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => MfaInputComponent),
			multi: true,
		},
	],
	templateUrl: './mfa-input.component.html',
	styleUrl: './mfa-input.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaInputComponent implements ControlValueAccessor {
	digits: string[] = ['', '', '', '', '', ''];
	@ViewChildren('inputBox') inputBoxes!: QueryList<
		ElementRef<HTMLInputElement>
	>;

	onChange: (value: string) => void = () => {};
	onTouched: () => void = () => {};

	writeValue(value: string): void {
		if (value && typeof value === 'string') {
			this.digits = value.split('').slice(0, 6);
			while (this.digits.length < 6) {
				this.digits.push('');
			}
		} else {
			this.digits = ['', '', '', '', '', ''];
		}
	}

	registerOnChange(fn: (value: string) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	onInput(index: number, event: Event): void {
		const input = event.target as HTMLInputElement;
		const val = input.value;

		if (val.length > 1) {
			// Handle paste or multi-character input
			const pasteData = val.slice(0, 6 - index);
			for (let i = 0; i < pasteData.length; i++) {
				this.digits[index + i] = pasteData[i];
			}
			input.value = this.digits[index];
		} else {
			this.digits[index] = val;
		}

		this.updateValue();

		if (val && index < 5) {
			this.inputBoxes.toArray()[index + 1].nativeElement.focus();
		}
	}

	onKeyDown(index: number, event: KeyboardEvent): void {
		if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
			this.inputBoxes.toArray()[index - 1].nativeElement.focus();
		}
	}

	onPaste(event: ClipboardEvent): void {
		event.preventDefault();
		const pasteData = event.clipboardData?.getData('text') || '';
		const digits = pasteData.replace(/\D/g, '').split('').slice(0, 6);

		digits.forEach((digit, i) => {
			if (i < 6) {
				this.digits[i] = digit;
			}
		});

		this.updateValue();

		// Focus the last filled input or the first empty one
		const nextIndex = Math.min(digits.length, 5);
		this.inputBoxes.toArray()[nextIndex].nativeElement.focus();
	}

	private updateValue(): void {
		const value = this.digits.join('');
		this.onChange(value);
		this.onTouched();
	}
}
