import {
	ChangeDetectionStrategy,
	Component,
	computed,
	OnInit,
	signal,
	input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChapterLabelPipe } from '@shared/utils/pipes/chapter-label-pipe';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';

export interface BookDownloadChapter {
	id: string;
	title?: string;
	index: number;
}

export interface BookDownloadResult {
	format: 'images' | 'pdfs';
	chapterIds: string[];
}

import { CheckboxComponent } from '@ui/atoms/inputs/checkbox/checkbox.component';

@Component({
	selector: 'app-book-download-modal',
	standalone: true,
	imports: [
		FormsModule,
		ButtonComponent,
		IconsComponent,
		CheckboxComponent,
		ChapterLabelPipe,
	],
	templateUrl: './book-download-modal.component.html',
	styleUrls: ['./book-download-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookDownloadModalComponent implements OnInit {
	chapters = input<BookDownloadChapter[]>([]);
	bookTitle = input('');
	close = input<(result: BookDownloadResult | null) => void>();

	selectedFormat = signal<'images' | 'pdfs'>('images');
	selectedChapters = signal<Set<string>>(new Set());

	// Computed para controlar estado do "selecionar todos"
	allSelected = computed(() => {
		return (
			this.chapters().length > 0 &&
			this.selectedChapters().size === this.chapters().length
		);
	});

	someSelected = computed(() => {
		const size = this.selectedChapters().size;
		return size > 0 && size < this.chapters().length;
	});

	ngOnInit(): void {
		// Inicializa todos os capítulos como selecionados
		const allIds = new Set(this.chapters().map((ch) => ch.id));
		this.selectedChapters.set(allIds);
	}

	toggleSelectAll(): void {
		if (this.allSelected()) {
			this.selectedChapters.set(new Set());
		} else {
			const allIds = new Set(this.chapters().map((ch) => ch.id));
			this.selectedChapters.set(allIds);
		}
	}

	toggleChapter(id: string): void {
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

	confirm(): void {
		if (this.selectedChapters().size === 0) {
			return;
		}

		const closeFunc = this.close();
		if (closeFunc) {
			closeFunc({
				format: this.selectedFormat(),
				chapterIds: Array.from(this.selectedChapters()),
			});
		}
	}

	cancel(): void {
		const closeFunc = this.close();
		if (closeFunc) {
			closeFunc(null);
		}
	}

	getChapterLabel(chapter: BookDownloadChapter): string {
		return chapter.title || `Capítulo ${chapter.index}`;
	}
}
