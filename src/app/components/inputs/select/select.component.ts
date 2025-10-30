import { Component, ElementRef, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

export type SelectOption = { value: any; label: string };

@Component({
    selector: 'app-select',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './select.component.html',
    styleUrls: ['./select.component.scss'],
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
    @Input() placeholder: string = 'Selecione uma opção';
    @Input() options: { value: string; label: string }[] = [];
    @Input() name: string = '';
    @Output() valueChange: EventEmitter<string> = new EventEmitter<string>();
    @Output() change: EventEmitter<string> = new EventEmitter<string>()

    value: string = '';
    isOpen: boolean = false;
    isDisabled: boolean = false;

    constructor(private host: ElementRef<HTMLElement>) {}

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
        const selected = this.options.find(opt => opt.value === this.value);
        return selected ? selected.label : this.placeholder;
    }

    closeDropdown(): void {
        this.isOpen = false;
    }
}
