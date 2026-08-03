import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	OnChanges,
	OnInit,
	SimpleChanges,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cover } from '@models/book.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';
import { ImageFallbackDirective } from '@ui/directives/image-fallback.directive';

export interface CoverEditSaveEvent {
	id: string;
	title: string;
	file?: File;
}

@Component({
	selector: 'app-cover-edit-modal',
	standalone: true,
	imports: [
		FormsModule,
		ButtonComponent,
		TextInputComponent,
		IconsComponent,
		ImageFallbackDirective,
	],
	templateUrl: './cover-edit-modal.component.html',
	styleUrls: ['./cover-edit-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverEditModalComponent implements OnInit, OnChanges {
	cover = input.required<Cover>();
	close = input<(result: CoverEditSaveEvent | null) => void>();

	editedTitle = signal<string>('');
	selectedFile = signal<File | null>(null);
	previewUrl = signal<string | null>(null);

	hasImage = computed(() => !!this.previewUrl());

	ngOnInit(): void {
		this.editedTitle.set(this.cover()?.title || '');
		this.previewUrl.set(this.cover()?.url || null);
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['cover'] && this.cover()) {
			this.editedTitle.set(this.cover().title || '');
			this.previewUrl.set(this.cover().url || null);
			this.selectedFile.set(null);
		}
	}

	onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			this.selectedFile.set(input.files[0]);
			this.previewUrl.set(URL.createObjectURL(input.files[0]));
		}
	}

	triggerFileInput(fileInput: HTMLInputElement): void {
		fileInput.click();
	}

	onSave(): void {
		const closeFunc = this.close();
		if (closeFunc) {
			closeFunc({
				id: this.cover().id,
				title: this.editedTitle(),
				file: this.selectedFile() || undefined,
			});
		}
	}

	onCancel(): void {
		const file = this.selectedFile();
		const preview = this.previewUrl();
		if (file && preview) {
			URL.revokeObjectURL(preview);
		}
		const closeFunc = this.close();
		if (closeFunc) {
			closeFunc(null);
		}
	}
}
