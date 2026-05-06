import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

export type ButtonVariant = 'primary' | 'outline' | 'text';
export type ButtonRounded = 'none' | 'small' | 'medium' | 'large' | 'full';
export type ButtonFill = 'full' | 'border' | 'none';
export type ButtonRadio = 'square' | 'normal';
export type ButtonPadding = 'none' | 'normal';

@Component({
  selector: 'app-button',
  imports: [IconsComponent],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonComponent {
  buttonRef = viewChild<ElementRef<HTMLButtonElement>>('button');
  
  id = input<string>();
  type = input<string>('button');
  variant = input<ButtonVariant>('primary');
  rounded = input<ButtonRounded>('full');
  fill = input<ButtonFill>('full');
  radio = input<ButtonRadio>('normal');
  padding = input<ButtonPadding>('normal');
  rightIcon = input<string | null>(null);
  leftIcon = input<string | null>(null);
  disabled = input<boolean>(false);
}

