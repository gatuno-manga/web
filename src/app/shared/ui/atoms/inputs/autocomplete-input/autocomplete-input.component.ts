import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, inject, input, model, output, signal, viewChild, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';

export interface AutocompleteOption {
	id: any;
	label: string;
	description?: string;
	image?: string;
}

@Component({
	selector: 'app-autocomplete-input',
	standalone: true,
	imports: [CommonModule, FormsModule, IconsComponent],
	templateUrl: './autocomplete-input.component.html',
	styleUrl: './autocomplete-input.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => AutocompleteInputComponent),
			multi: true,
		},
	],
})
export class AutocompleteInputComponent implements ControlValueAccessor {
	id = input<string>('autocomplete-input');
	placeholder = input<string>('Comece a digitar...');
	label = input<string>('');
	leftIcon = input<string | null>(null);
	options = input<AutocompleteOption[]>([]);
	isLoading = input<boolean>(false);
	debounceTime = input<number>(300);

	queryChange = output<string>();
	optionSelected = output<AutocompleteOption>();

	value = model<string>('');
	isOpen = signal(false);
	
	private onChange: (value: string) => void = () => {};
	private onTouched: () => void = () => {};

	onInput(event: Event) {
		const target = event.target as HTMLInputElement;
		this.value.set(target.value);
		this.onChange(target.value);
		this.queryChange.emit(target.value);
		this.isOpen.set(true);
	}

	selectOption(option: AutocompleteOption) {
		this.value.set(option.label);
		this.onChange(option.label);
		this.optionSelected.emit(option);
		this.isOpen.set(false);
	}

	onFocus() {
		if (this.value()) {
			this.isOpen.set(true);
		}
	}

	onBlur() {
		// Small delay to allow click on option
		setTimeout(() => {
			this.isOpen.set(false);
			this.onTouched();
		}, 200);
	}

	writeValue(value: string): void {
		this.value.set(value || '');
	}

	registerOnChange(fn: any): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: any): void {
		this.onTouched = fn;
	}

	setDisabledState?(isDisabled: boolean): void {}
}
