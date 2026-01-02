import { Component, Input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { IconsComponent } from '@components/icons/icons.component';

export interface BookDownloadChapter {
    id: string;
    title?: string;
    index: number;
}

export interface BookDownloadResult {
    format: 'images' | 'pdfs';
    chapterIds: string[];
}

@Component({
    selector: 'app-book-download-modal',
    standalone: true,
    imports: [FormsModule, ButtonComponent, IconsComponent],
    templateUrl: './book-download-modal.component.html',
    styleUrls: ['./book-download-modal.component.scss']
})
export class BookDownloadModalComponent {
    @Input() chapters: BookDownloadChapter[] = [];
    @Input() bookTitle: string = '';
    @Input() close!: (result: BookDownloadResult | null) => void;

    selectedFormat = signal<'images' | 'pdfs'>('images');
    selectedChapters = signal<Set<string>>(new Set());

    // Computed para controlar estado do "selecionar todos"
    allSelected = computed(() => {
        return this.chapters.length > 0 && this.selectedChapters().size === this.chapters.length;
    });

    someSelected = computed(() => {
        const size = this.selectedChapters().size;
        return size > 0 && size < this.chapters.length;
    });

    ngOnInit() {
        // Inicializa todos os capítulos como selecionados
        const allIds = new Set(this.chapters.map(ch => ch.id));
        this.selectedChapters.set(allIds);
    }

    toggleSelectAll() {
        if (this.allSelected()) {
            this.selectedChapters.set(new Set());
        } else {
            const allIds = new Set(this.chapters.map(ch => ch.id));
            this.selectedChapters.set(allIds);
        }
    }

    toggleChapter(id: string) {
        const current = new Set(this.selectedChapters());
        if (current.has(id)) {
            current.delete(id);
        } else {
            current.add(id);
        }
        this.selectedChapters.set(current);
    }

    isChapterSelected(id: string): boolean {
        return this.selectedChapters().has(id);
    }

    confirm() {
        if (this.selectedChapters().size === 0) {
            return;
        }

        if (this.close) {
            this.close({
                format: this.selectedFormat(),
                chapterIds: Array.from(this.selectedChapters())
            });
        }
    }

    cancel() {
        if (this.close) {
            this.close(null);
        }
    }

    getChapterLabel(chapter: BookDownloadChapter): string {
        return chapter.title || `Capítulo ${chapter.index}`;
    }
}
