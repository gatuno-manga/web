import {
	Component,
	input,
	output,
	signal,
	computed,
	ChangeDetectionStrategy,
	ElementRef,
	viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-file-input',
	standalone: true,
	imports: [CommonModule, IconsComponent],
	templateUrl: './file-input.component.html',
	styleUrl: './file-input.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileInputComponent {
	id = input<string>('file-input');
	label = input<string>('Selecionar arquivo');
	accept = input<string>('image/*');
	maxSize = input<number | null>(null); // MB
	initialPreviewUrl = input<string | null>(null);
	isLoading = input<boolean>(false);
	variant = input<'default' | 'avatar' | 'banner'>('default');

	fileSelected = output<File | null>();
	error = output<string | null>();

	inputRef = viewChild<ElementRef<HTMLInputElement>>('input');

	isDragging = signal(false);
	localPreviewUrl = signal<string | null>(null);
	errorMessage = signal<string | null>(null);

	previewUrl = computed(() => {
		if (this.localPreviewUrl()) return this.localPreviewUrl();
		return this.initialPreviewUrl();
	});

	onDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!this.isLoading()) {
			this.isDragging.set(true);
		}
	}

	onDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		this.isDragging.set(false);
	}

	onDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		this.isDragging.set(false);

		if (this.isLoading()) return;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			this.handleFiles(files);
		}
	}

	onPaste(event: ClipboardEvent) {
		if (this.isLoading()) return;

		const items = event.clipboardData?.items;
		if (items) {
			for (let i = 0; i < items.length; i++) {
				if (items[i].type.indexOf('image') !== -1) {
					const file = items[i].getAsFile();
					if (file) {
						this.handleFiles([file] as unknown as FileList);
					}
				}
			}
		}
	}

	onFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			this.handleFiles(input.files);
		}
	}

	removeFile(event: Event) {
		event.stopPropagation();
		this.localPreviewUrl.set(null);
		this.errorMessage.set(null);
		this.fileSelected.emit(null);
		if (this.inputRef()) {
			this.inputRef()!.nativeElement.value = '';
		}
	}

	triggerInput() {
		if (this.isLoading()) return;
		this.inputRef()?.nativeElement.click();
	}

	private handleFiles(files: FileList | File[]) {
		const file = files[0];
		this.errorMessage.set(null);

		// Validation: Format
		if (this.accept()) {
			const acceptedTypes = this.accept()
				.split(',')
				.map((t) => t.trim());
			const isValidType = acceptedTypes.some((type) => {
				if (type.endsWith('/*')) {
					return file.type.startsWith(type.replace('/*', ''));
				}
				return file.type === type || file.name.endsWith(type);
			});

			if (!isValidType) {
				const err = 'Formato de arquivo não suportado.';
				this.errorMessage.set(err);
				this.error.emit(err);
				return;
			}
		}

		// Validation: Size
		if (this.maxSize() && file.size > this.maxSize()! * 1024 * 1024) {
			const err = `O arquivo excede o tamanho máximo de ${this.maxSize()}MB.`;
			this.errorMessage.set(err);
			this.error.emit(err);
			return;
		}

		// Success: Generate Preview
		const reader = new FileReader();
		reader.onload = (e) => {
			this.localPreviewUrl.set(e.target?.result as string);
		};
		reader.readAsDataURL(file);

		this.fileSelected.emit(file);
	}
}
