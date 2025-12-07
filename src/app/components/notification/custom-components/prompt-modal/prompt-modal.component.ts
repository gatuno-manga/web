import { Component, Input, Output, EventEmitter, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { TextAreaComponent } from '@components/inputs/text-area/text-area.component';

@Component({
  selector: 'app-prompt-modal',
  standalone: true,
  imports: [FormsModule, ButtonComponent, TextAreaComponent],
  template: `
    <div class="prompt-content">
      <div class="header">
        <h2>{{ title }}</h2>
        @if(message) {
          <p>{{ message }}</p>
        }
      </div>
      <div class="body">
        <app-text-area
          id="prompt-input"
          [(ngModel)]="value"
          [placeholder]="placeholder"
          [rows]="3"
        ></app-text-area>
      </div>
      <div class="footer">
        <app-button (click)="cancel()" variant="text">Cancelar</app-button>
        <app-button (click)="confirm()" variant="primary">Confirmar</app-button>
      </div>
    </div>
  `,
  styles: [`
    .prompt-content {
      background: var(--app-background-color);
      padding: 1.5rem;
      border-radius: 12px;
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .header {
      h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--app-text-color);
      }
      p {
        margin: 0.5rem 0 0;
        color: var(--app-text-color-secondary);
        font-size: 0.9rem;
      }
    }

    .body {
      width: 100%;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  `]
})
export class PromptModalComponent implements AfterViewInit {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() placeholder: string = '';
  @Input() value: string = '';
  
  @Input() close!: (value: string | null) => void;

  @ViewChild(TextAreaComponent) textArea!: TextAreaComponent;

  ngAfterViewInit() {
    // Focus the textarea after view init
    setTimeout(() => {
        if (this.textArea) {
            this.textArea.textareaRef?.nativeElement?.focus();
        }
    }, 100);
  }

  confirm() {
    if (this.close) {
      this.close(this.value);
    }
  }

  cancel() {
    if (this.close) {
      this.close(null);
    }
  }
}
