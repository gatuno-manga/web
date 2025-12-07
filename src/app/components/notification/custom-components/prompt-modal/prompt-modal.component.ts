import { Component, Input, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { TextAreaComponent } from '@components/inputs/text-area/text-area.component';

@Component({
  selector: 'app-prompt-modal',
  standalone: true,
  imports: [FormsModule, ButtonComponent, TextAreaComponent],
  templateUrl: './prompt-modal.component.html',
  styleUrls: ['./prompt-modal.component.scss']
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