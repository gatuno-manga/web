import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { IconsComponent } from '../../icons/icons.component';

export type ButtonVariant = 'primary' | 'outline' | 'text';
export type ButtonRounded = 'none' | 'small' | 'medium' | 'large' | 'full';
export type ButtonFill = 'full' | 'border';
export type ButtonRadio = 'square' | 'normal';
export type ButtonPadding = 'none' | 'normal';

@Component({
  selector: 'app-button',
  imports: [IconsComponent],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss'
})
export class ButtonComponent {
  @ViewChild('button') buttonRef!: ElementRef<HTMLButtonElement>;
  @Input() id!: string;
  @Input() type: string = 'button';
  @Input() variant: ButtonVariant = 'primary';
  @Input() rounded: ButtonRounded = 'full';
  @Input() fill: ButtonFill = 'full';
  @Input() radio: ButtonRadio = 'normal';
  @Input() padding: ButtonPadding = 'normal';
  @Input() rightIcon: string | null = null;
  @Input() leftIcon: string | null = null;
  @Input() disabled: boolean = false;
}
