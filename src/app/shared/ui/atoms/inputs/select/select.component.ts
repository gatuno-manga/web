import { ChangeDetectionStrategy, Component, ElementRef, input, output, forwardRef, inject, signal, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

export type SelectOption = { value: any; label: string };

@Component({
    selector: 'app-select',
    standalone: true,
    imports: [IconsComponent, FormsModule],
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
    searchable = input<boolean>(false);
    leftIcon = input<string | null>(null);
    chevronIcon = input<string>('chevron-down');
    
    valueChange = output<string>();
    change = output<string>();

    value: string = '';
    isOpen: boolean = false;
    isDisabled: boolean = false;
    
    searchQuery = signal<string>('');

    filteredOptions = computed(() => {
        const query = this.searchQuery().toLowerCase();
        if (!query) return this.options();
        return this.options().filter(opt => opt.label.toLowerCase().includes(query));
    });

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
                this.searchQuery.set(''); // Reset search on open
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
    
    onSearchInput(event: Event) {
        event.stopPropagation(); // Prevent closing dropdown
    }
}

