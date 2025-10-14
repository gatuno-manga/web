import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { IconsComponent } from '../../icons/icons.component';

export type ButtonVariant = 'primary' | 'outline' | 'text';

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
  @Input() rightIcon: string | null = null;
  @Input() leftIcon: string | null = null;
}
