import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	computed,
	ElementRef,
	forwardRef,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import {
	ControlValueAccessor,
	FormsModule,
	NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { OverlayModule, ConnectionPositionPair } from '@angular/cdk/overlay';

export type SelectOption = {
	value: string | number | boolean;
	label: string;
	/** Ícone opcional exibido ao lado do label (usando app-icons) */
	icon?: string;
	/** Imagem (URL) exibida ao lado do label (ex: bandeiras) */
	imageUrl?: string;
	/** Texto secundário exibido abaixo do label */
	description?: string;
	/** Desabilita a opção individualmente */
	disabled?: boolean;
};

export type SelectSize = 'sm' | 'md' | 'lg';

@Component({
	selector: 'app-select',
	standalone: true,
	imports: [IconsComponent, FormsModule, OverlayModule],
	templateUrl: './select.component.html',
	styleUrls: ['./select.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => SelectComponent),
			multi: true,
		},
	],
	host: {
		'[class.select-open]': 'isOpen()',
		'[attr.data-size]': 'size()',
	},
})
export class SelectComponent implements ControlValueAccessor {
	placeholder = input<string>('Selecione uma opção');
	label = input<string | null>(null);
	options = input<SelectOption[]>([]);
	name = input<string>('');
	searchable = input<boolean>(false);
	leftIcon = input<string | null>(null);
	chevronIcon = input<string>('chevron-down');
	size = input<SelectSize>('md');
	dropdownPosition = input<'bottom' | 'top'>('bottom');

	valueChange = output<string>();
	change = output<string>();

	value = signal<string>('');
	isOpen = signal<boolean>(false);
	isDisabled = signal<boolean>(false);

	searchQuery = signal<string>('');

	positions = [
		new ConnectionPositionPair(
			{ originX: 'start', originY: 'bottom' },
			{ overlayX: 'start', overlayY: 'top' },
			0, 4 // offset Y
		),
		new ConnectionPositionPair(
			{ originX: 'start', originY: 'top' },
			{ overlayX: 'start', overlayY: 'bottom' },
			0, -4
		)
	];

	filteredOptions = computed(() => {
		const query = this.searchQuery().toLowerCase();
		if (!query) return this.options();
		return this.options().filter((opt) =>
			opt.label.toLowerCase().includes(query),
		);
	});

	selectedOption = computed(() =>
		this.options().find((opt) => String(opt.value) === this.value()),
	);

	hasValue = computed(() => !!this.value());

	private host = inject(ElementRef<HTMLElement>);
	private cdr = inject(ChangeDetectorRef);

	private onChange: (value: string) => void = () => {};
	private onTouched: () => void = () => {};

	writeValue(value: string): void {
		this.value.set(value || '');
		this.cdr.markForCheck();
	}

	registerOnChange(fn: (value: string) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.isDisabled.set(isDisabled);
	}

	toggleDropdown(): void {
		if (this.isDisabled()) return;
		const next = !this.isOpen();
		this.isOpen.set(next);
		if (next) {
			this.searchQuery.set('');
			this.onTouched();
		}
	}

	selectOption(option: SelectOption): void {
		if (option.disabled) return;
		const val = String(option.value);
		this.value.set(val);
		this.onChange(val);
		this.valueChange.emit(val);
		this.change.emit(val);
		this.host.nativeElement.dispatchEvent(
			new CustomEvent('change', { detail: val, bubbles: true }),
		);
		this.isOpen.set(false);
	}

	getSelectedLabel(): string {
		return this.selectedOption()?.label ?? this.placeholder();
	}

	closeDropdown(): void {
		this.isOpen.set(false);
	}

	onSearchInput(event: Event) {
		event.stopPropagation();
	}

	iconSize(): string {
		const map: Record<SelectSize, string> = {
			sm: '14px',
			md: '16px',
			lg: '18px',
		};
		return map[this.size()];
	}

	isSelected(option: SelectOption): boolean {
		return String(option.value) === this.value();
	}
}
