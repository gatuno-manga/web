import { Component, ElementRef, forwardRef, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
	selector: 'app-text-area',
	imports: [NgClass],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TextAreaComponent),
			multi: true,
		},
	],
	standalone: true,
	templateUrl: './text-area.component.html',
	styleUrl: './text-area.component.scss'
})
export class TextAreaComponent implements ControlValueAccessor {
	@Output() focus: EventEmitter<void> = new EventEmitter<void>();
	@Output() blur: EventEmitter<void> = new EventEmitter<void>();
	@ViewChild('textarea') textareaRef!: ElementRef<HTMLTextAreaElement>;
	@Input() id!: string;
	@Input() placeholder: string = '';
	@Input() value: string = '';
    @Input() rows: number = 3;
	@Input() errors: any = null;
	@Input() touched: boolean = false;
    
	isFocused: boolean = false;
	firstLostFocus: boolean = false;
	inputErrorMessages: {
		[key: string]: string;
	} = {
			required: 'Este campo é obrigatório',
			minlength: 'Não pode ser menor que {{requiredLength}} caracteres',
			maxlength: 'Não pode ser maior que {{requiredLength}} caracteres',
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

    onTouched(): void {
		this.touched = true;
	}

	writeValue(value: string): void {
		this.value = value || '';
	}

	registerOnChange(fn: (value: string) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	onInput(event: Event): void {
		this.touched = true;
		const target = event.target as HTMLTextAreaElement;
		this.value = target.value;
		this.onChange(this.value);
	}

	onChange(value: string): void {
		this.touched = true;
	}

	errorMessages(): string[] {
		if (this.errors && this.firstLostFocus && this.touched) {
			const errorKeys = Object.keys(this.errors);
			if (errorKeys.length > 0) {
				const messages = errorKeys.map(key => {
					const message = this.inputErrorMessages[key];

					if (message) {
						if (typeof this.errors[key] === 'object' && this.errors[key] !== null) {
							for (const prop in this.errors[key]) {
								if (this.errors[key].hasOwnProperty(prop)) {
									return message.replace(`{{${prop}}}`, this.errors[key][prop] || '');
								}
							}
						}
						return message;
					}
					else if (typeof this.errors[key] === 'string') {
						return this.errors[key];
					}

					return 'error ' + key;
				});
				return messages.filter(msg => msg !== '');
			}
		}
		return [];
	}
}
