import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cover } from '@models/book.models';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { TextInputComponent } from '@components/inputs/text-input/text-input.component';
import { IconsComponent } from '@components/icons/icons.component';

export interface CoverEditSaveEvent {
    id: string;
    title: string;
    file?: File;
}

@Component({
    selector: 'app-cover-edit-modal',
    standalone: true,
    imports: [FormsModule, ButtonComponent, TextInputComponent, IconsComponent],
    templateUrl: './cover-edit-modal.component.html',
    styleUrls: ['./cover-edit-modal.component.scss']
})
export class CoverEditModalComponent implements OnInit, OnChanges {
    @Input() cover!: Cover;
    @Input() close!: (result: CoverEditSaveEvent | null) => void;

    editedTitle = signal<string>('');
    selectedFile = signal<File | null>(null);
    previewUrl = signal<string | null>(null);
    imageError = signal<boolean>(false);

    hasImage = computed(() => !!this.previewUrl());

    ngOnInit(): void {
        this.editedTitle.set(this.cover?.title || '');
        this.previewUrl.set(this.cover?.url || null);
        this.imageError.set(false);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['cover'] && this.cover) {
            this.editedTitle.set(this.cover.title || '');
            this.previewUrl.set(this.cover.url || null);
            this.selectedFile.set(null);
            this.imageError.set(false);
        }
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.selectedFile.set(input.files[0]);
            this.previewUrl.set(URL.createObjectURL(input.files[0]));
            this.imageError.set(false);
        }
    }

    onImageError(): void {
        this.imageError.set(true);
    }

    triggerFileInput(fileInput: HTMLInputElement): void {
        fileInput.click();
    }

    onSave(): void {
        if (this.close) {
            this.close({
                id: this.cover.id,
                title: this.editedTitle(),
                file: this.selectedFile() || undefined
            });
        }
    }

    onCancel(): void {
        const file = this.selectedFile();
        const preview = this.previewUrl();
        if (file && preview) {
            URL.revokeObjectURL(preview);
        }
        if (this.close) {
            this.close(null);
        }
    }
}
