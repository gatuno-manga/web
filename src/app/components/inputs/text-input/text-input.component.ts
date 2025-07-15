import { Component, ElementRef, forwardRef, Input, ViewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconsComponent } from '../../icons/icons.component';
import { ControlValueAccessor } from '@angular/forms';
import { NgClass, NgIf } from '@angular/common';
@Component({
  selector: 'app-input[type="text"], app-input[type="email"]',
  imports: [IconsComponent, NgClass, NgIf],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true,
    },
  ],
  standalone: true,
  templateUrl: './text-input.component.html',
  styleUrl: './text-input.component.scss'
})
export class TextInputComponent implements ControlValueAccessor {
  @ViewChild('input') inputRef!: ElementRef<HTMLInputElement>;
  @Input() id!: string;
  @Input() type: string = 'text';
  @Input() placeholder: string = '';
  @Input() value: string = '';
  @Input() errors: any = null;
  @Input() touched: boolean = false;
  @Input() rightIcon: string | null = null;
  @Input() leftIcon: string | null = null;
  @Input() leftIconClick?: () => void;
  @Input() rightIconClick?: () => void;
  isFocused: boolean = false;

  onLeftIconClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.leftIconClick) {
      this.leftIconClick();
    }
  }

  onRightIconClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.rightIconClick) {
      this.rightIconClick();
    }
  }

  onBlur(value: string): void {}
  setDisabledState?(isDisabled: boolean): void {}
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
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }
  onChange(value: string): void {
    this.touched = true;
  }

  getInputElement(): HTMLInputElement | null {
    return this.inputRef?.nativeElement || null;
  }
}

@Component({
  selector: 'app-input[type="password"]',
  imports: [IconsComponent, NgClass, NgIf],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInputComponent),
      multi: true,
    },
  ],
  standalone: true,
  templateUrl: './text-input.component.html',
  styleUrl: './text-input.component.scss'
})
export class PasswordInputComponent extends TextInputComponent {
  @Input() showPassword: boolean = false;
  override rightIcon: string = 'eye';
  override rightIconClick = () => this.togglePasswordVisibility();

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    if (this.inputRef) {
      this.inputRef.nativeElement.type = this.showPassword ? 'text' : 'password';
      this.rightIcon = this.showPassword ? 'eye' : 'eye-close';
      this.inputRef.nativeElement.focus();
      this.inputRef.nativeElement.setSelectionRange(this.inputRef.nativeElement.value.length, this.inputRef.nativeElement.value.length);
    }
  }

  get inputType(): string {
    return this.showPassword ? 'text' : 'password';
  }
}


