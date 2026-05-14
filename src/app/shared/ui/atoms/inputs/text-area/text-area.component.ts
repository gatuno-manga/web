import { NgClass } from '@angular/common';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	effect,
	forwardRef,
	input,
	model,
	output,
	viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-text-area',
	imports: [NgClass, IconsComponent],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TextAreaComponent),
			multi: true,
		},
	],
	standalone: true,
	templateUrl: './text-area.component.html',
	styleUrl: './text-area.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextAreaComponent implements ControlValueAccessor, AfterViewInit {
	focus = output<void>();
	blur = output<void>();
	textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

	id = input<string>();
	placeholder = input<string>('');
	rows = input<number>(3);
	maxLength = input<number | null>(null);
	showCounter = input<boolean>(false);
	autoExpand = input<boolean>(false);
	maxHeight = input<string>('300px');
	leftIcon = input<string | null>(null);
	clearable = input<boolean>(false);
	allowResize = input<boolean>(true);

	errors = input<any>(null);
	touched = input<boolean>(false);

	value = model<string>('');

	characterCount = computed(() => this.value()?.length || 0);

	isFocused = false;
	firstLostFocus = false;

	inputErrorMessages: {
		[key: string]: string;
	} = {
		required: 'Este campo é obrigatório',
		minlength: 'Não pode ser menor que {{requiredLength}} caracteres',
		maxlength: 'Não pode ser maior que {{requiredLength}} caracteres',
	};

	constructor() {
		effect(() => {
			const expand = this.autoExpand();
			if (expand) {
				// Re-evaluate whenever value changes to adjust height
				this.value();
				setTimeout(() => this.adjustHeight(), 0);
			}
		});
	}

	ngAfterViewInit() {
		if (this.autoExpand()) {
			this.adjustHeight();
		}
	}

	onFocus(): void {
		this.isFocused = true;
		this.focus.emit();
	}

	onBlur(_value: string): void {
		this.isFocused = false;
		this.firstLostFocus = true;
		this.blur.emit();
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

	setDisabledState?(_isDisabled: boolean): void {}

	onInput(event: Event): void {
		const target = event.target as HTMLTextAreaElement;
		this.value.set(target.value);
		this.onChange(target.value);
		this.onTouched();
	}

	clear(event: Event): void {
		event.stopPropagation();
		this.value.set('');
		this.onChange('');
		this.onTouched();
		this.textareaRef()?.nativeElement.focus();
	}

	onChange: (value: string) => void = () => {};
	onTouched: () => void = () => {};

	private adjustHeight(): void {
		const textarea = this.textareaRef()?.nativeElement;
		if (!textarea) return;

		textarea.style.height = 'auto';
		textarea.style.height = `${textarea.scrollHeight}px`;
	}

	errorMessages(): string[] {
		const errorsValue = this.errors();
		if (
			errorsValue &&
			this.firstLostFocus &&
			(this.touched() || this.firstLostFocus)
		) {
			const errorKeys = Object.keys(errorsValue);
			if (errorKeys.length > 0) {
				const messages = errorKeys.map((key) => {
					const message = this.inputErrorMessages[key];

					if (message) {
						if (
							typeof errorsValue[key] === 'object' &&
							errorsValue[key] !== null
						) {
							for (const prop in errorsValue[key]) {
								if (Object.hasOwn(errorsValue[key], prop)) {
									return message.replace(
										`{{${prop}}}`,
										errorsValue[key][prop] || '',
									);
								}
							}
						}
						return message;
					} else if (typeof errorsValue[key] === 'string') {
						return errorsValue[key];
					}

					return `error ${key}`;
				});
				return messages.filter((msg) => msg !== '');
			}
		}
		return [];
	}
}
