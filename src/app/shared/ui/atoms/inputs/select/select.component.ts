import { ChangeDetectionStrategy, Component, ElementRef, input, output, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type SelectOption = { value: any; label: string };

@Component({
    selector: 'app-select',
    standalone: true,
    imports: [],
    templateUrl: './select.component.html',
    styleUrls: ['./select.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SelectComponent),
            multi: true
        }
    ],
    host: {
        '[class.select-open]': 'isOpen'
    }
})
export class SelectComponent implements ControlValueAccessor {
    placeholder = input<string>('Selecione uma opção');
    options = input<{ value: string; label: string }[]>([]);
    name = input<string>('');
    valueChange = output<string>();
    change = output<string>();

    value: string = '';
    isOpen: boolean = false;
    isDisabled: boolean = false;

    private host = inject(ElementRef<HTMLElement>);

    private onChange: (value: string) => void = () => {};
    private onTouched: () => void = () => {};

    writeValue(value: string): void {
        this.value = value || '';
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.isDisabled = isDisabled;
    }

    toggleDropdown(): void {
        if (!this.isDisabled) {
            this.isOpen = !this.isOpen;
            if (this.isOpen) {
                this.onTouched();
            }
        }
    }

    selectOption(option: { value: string; label: string }): void {
        this.valueChange.emit(option.value);
        this.change.emit(option.value);
        this.host.nativeElement.dispatchEvent(new CustomEvent('change', { detail: option.value, bubbles: true }));
        this.value = option.value;
        this.onChange(this.value);
        this.isOpen = false;
    }

    getSelectedLabel(): string {
        const selected = this.options().find(opt => opt.value === this.value);
        return selected ? selected.label : this.placeholder();
    }

    closeDropdown(): void {
        this.isOpen = false;
    }
}

