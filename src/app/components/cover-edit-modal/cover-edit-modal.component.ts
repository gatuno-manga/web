import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Cover } from '../../models/book.models';
import { ButtonComponent } from '../inputs/button/button.component';

@Component({
    selector: 'app-cover-edit-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonComponent],
    templateUrl: './cover-edit-modal.component.html',
    styleUrl: './cover-edit-modal.component.scss'
})
export class CoverEditModalComponent implements OnInit, OnChanges {
    @Input() cover!: Cover;
    @Output() save = new EventEmitter<{ id: string; title: string }>();
    @Output() cancel = new EventEmitter<void>();

    editedTitle: string = '';

    ngOnInit() {
        this.editedTitle = this.cover?.title || '';
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['cover'] && this.cover) {
            this.editedTitle = this.cover.title || '';
        }
    }

    onSave() {
        this.save.emit({ id: this.cover.id, title: this.editedTitle });
    }

    onCancel() {
        this.cancel.emit();
    }
}
