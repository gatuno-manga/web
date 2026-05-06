import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, viewChild, output, model } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ControlValueAccessor } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
	selector: 'app-input[type="text"], app-input[type="email"], app-input[type="number"]',
	imports: [IconsComponent, NgClass],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TextInputComponent),
			multi: true,
		},
	],
	standalone: true,
	templateUrl: './text-input.component.html',
	styleUrl: './text-input.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextInputComponent implements ControlValueAccessor {
	focus = output<void>();
	blur = output<void>();
	inputRef = viewChild<ElementRef<HTMLInputElement>>('input');
	
	id = input<string>();
	type = input<string>('text');
	placeholder = input<string>('');
	showLabel = input<boolean>(true);
	value = model<string>('');
	errors = input<any>(null);
	touched = input<boolean>(false);
	rightIconInput = input<string | null>(null, { alias: 'rightIcon' });
	leftIconInput = input<string | null>(null, { alias: 'leftIcon' });
	leftIconClick = input<(() => void) | undefined>();
	rightIconClick = input<(() => void) | undefined>();

	isFocused = false;
	firstLostFocus = false;

	// For template compatibility with PasswordInputComponent
	protected get passwordInputType(): string {
		return '';
	}
	protected get passwordRightIcon(): string {
		return '';
	}

	inputErrorMessages: {
		[key: string]: string;
	} = {
			required: 'Este campo é obrigatório',
			email: 'Insira um endereço de e-mail válido',
			minlength: 'Não pode ser menor que {{requiredLength}} caracteres',
			maxlength: 'Não pode ser maior que {{requiredLength}} caracteres',
			minUppercase: 'Deve conter pelo menos {{requiredLength}} letra(s) maiúscula(s)',
			minNumber: 'Deve conter pelo menos {{requiredLength}} número(s)',
			minSymbol: 'Deve conter pelo menos {{requiredLength}} símbolo(s)',
		}

	onLeftIconClick(event: MouseEvent): void {
		event.stopPropagation();
		const clickFn = this.leftIconClick();
		if (clickFn) {
			clickFn();
		}
	}

	onRightIconClick(event: MouseEvent): void {
		event.stopPropagation();
		const clickFn = this.rightIconClick();
		if (clickFn) {
			clickFn();
		}
	}

	onFocus(): void {
		this.isFocused = true;
		this.focus.emit();
	}

	onBlur(value: string): void {
		this.isFocused = false;
		this.firstLostFocus = true;
		this.blur.emit();
	}

	setDisabledState?(isDisabled: boolean): void {}

	onTouchedInternal(): void {
		this.onTouched();
	}

	writeValue(value: string): void {
		this.value.set(value || '');
	}

	registerOnChange(fn: (value: string) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	onInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		this.value.set(target.value);
		this.onChange(target.value);
		this.onTouched();
	}

	onChange: (value: string) => void = () => {};
	onTouched: () => void = () => {};

	getInputElement(): HTMLInputElement | null {
		return this.inputRef()?.nativeElement || null;
	}

	errorMessages(): string[] {
		const errorsValue = this.errors();
		if (errorsValue && this.firstLostFocus && (this.touched() || this.firstLostFocus)) {
			const errorKeys = Object.keys(errorsValue);
			if (errorKeys.length > 0) {
				const messages = errorKeys.map(key => {
					const message = this.inputErrorMessages[key];

					if (message) {
						if (typeof errorsValue[key] === 'object' && errorsValue[key] !== null) {
							for (const prop in errorsValue[key]) {
								if (errorsValue[key].hasOwnProperty(prop)) {
									return message.replace(`{{${prop}}}`, errorsValue[key][prop] || '');
								}
							}
						}
						return message;
					}
					else if (typeof errorsValue[key] === 'string') {
						return errorsValue[key];
					}

					return 'error ' + key;
				});
				return messages.filter(msg => msg !== '');
			}
		}
		return [];
	}
}

@Component({
	selector: 'app-input[type="password"]',
	imports: [IconsComponent, NgClass],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => PasswordInputComponent),
			multi: true,
		},
	],
	standalone: true,
	templateUrl: './text-input.component.html',
	styleUrl: './text-input.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordInputComponent extends TextInputComponent {
	showPassword = false;
	private _passwordRightIcon = 'eye';

	override get passwordRightIcon(): string {
		return this._passwordRightIcon;
	}

	override onRightIconClick(event: MouseEvent): void {
		event.stopPropagation();
		this.togglePasswordVisibility();
	}

	togglePasswordVisibility(): void {
		this.showPassword = !this.showPassword;
		const inputEl = this.inputRef()?.nativeElement;
		if (inputEl) {
			inputEl.type = this.showPassword ? 'text' : 'password';
			this._passwordRightIcon = this.showPassword ? 'eye' : 'eye-close';
			inputEl.focus();
			inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
		}
	}

	override get passwordInputType(): string {
		return this.showPassword ? 'text' : 'password';
	}
}





