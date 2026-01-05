import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Cover } from '../../models/book.models';
import { ButtonComponent } from '../inputs/button/button.component';
import { TextInputComponent } from '../inputs/text-input/text-input.component';
import { IconsComponent } from '../icons/icons.component';

export interface CoverEditSaveEvent {
    id: string;
    title: string;
    file?: File;
}

@Component({
    selector: 'app-cover-edit-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonComponent, TextInputComponent, IconsComponent],
    templateUrl: './cover-edit-modal.component.html',
    styleUrl: './cover-edit-modal.component.scss'
})
export class CoverEditModalComponent implements OnInit, OnChanges {
    @Input() cover!: Cover;
    @Output() save = new EventEmitter<CoverEditSaveEvent>();
    @Output() cancel = new EventEmitter<void>();

    editedTitle: string = '';
    selectedFile: File | null = null;
    previewUrl: string | null = null;
    imageError: boolean = false;

    ngOnInit() {
        this.editedTitle = this.cover?.title || '';
        this.previewUrl = this.cover?.url || null;
        this.imageError = false;
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['cover'] && this.cover) {
            this.editedTitle = this.cover.title || '';
            this.previewUrl = this.cover.url || null;
            this.selectedFile = null;
            this.imageError = false;
        }
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.selectedFile = input.files[0];
            this.previewUrl = URL.createObjectURL(this.selectedFile);
            this.imageError = false;
        }
    }

    onImageError() {
        this.imageError = true;
    }

    triggerFileInput(fileInput: HTMLInputElement) {
        fileInput.click();
    }

    get hasImage(): boolean {
        return !!this.previewUrl;
    }

    onSave() {
        this.save.emit({
            id: this.cover.id,
            title: this.editedTitle,
            file: this.selectedFile || undefined
        });
    }

    onCancel() {
        if (this.selectedFile && this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
        }
        this.cancel.emit();
    }
}
