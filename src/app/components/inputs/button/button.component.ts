import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { IconsComponent } from '../../icons/icons.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-button',
  imports: [IconsComponent, NgIf],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss'
})
export class ButtonComponent {
  @ViewChild('button') buttonRef!: ElementRef<HTMLButtonElement>;
  @Input() id!: string;
  @Input() type: string = 'text';
  @Input() rightIcon: string | null = null;
  @Input() leftIcon: string | null = null;
}
