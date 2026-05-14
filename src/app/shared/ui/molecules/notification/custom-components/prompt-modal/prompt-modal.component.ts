import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	input,
	signal,
	viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { TextAreaComponent } from '@ui/atoms/inputs/text-area/text-area.component';

@Component({
	selector: 'app-prompt-modal',
	standalone: true,
	imports: [FormsModule, ButtonComponent, TextAreaComponent],
	templateUrl: './prompt-modal.component.html',
	styleUrls: ['./prompt-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptModalComponent implements AfterViewInit {
	title = input<string>('');
	message = input<string>('');
	placeholder = input<string>('');
	initialValue = input<string>('', { alias: 'value' });

	close = input.required<(value: string | null) => void>();

	textArea = viewChild(TextAreaComponent);

	inputValue = signal<string>('');

	constructor() {
		// Initialize local signal with initial value
		this.inputValue.set(this.initialValue());
	}

	ngAfterViewInit(): void {
		setTimeout(() => {
			const textAreaComponent = this.textArea();
			if (textAreaComponent) {
				// Correctly calling the signal textareaRef()
				textAreaComponent.textareaRef()?.nativeElement?.focus();
			}
		}, 100);
	}

	confirm(): void {
		const closeFn = this.close();
		if (closeFn) {
			closeFn(this.inputValue());
		}
	}

	cancel(): void {
		const closeFn = this.close();
		if (closeFn) {
			closeFn(null);
		}
	}
}
