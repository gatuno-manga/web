import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	OnInit,
	signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { MetaDataService } from '@core/services/meta-data.service';
import {
	ReadingProgress,
	ReadingProgressService,
} from '@core/services/reading-progress.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import {
	BookBasic,
	Chapterlist,
	SensitiveContentResponse,
} from '@models/book.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';
import { firstValueFrom } from 'rxjs';

export interface HistoryEntry {
	progressId: string;
	bookId: string;
	bookTitle: string;
	bookCover: string;
	bookBlurHash?: string;
	bookDominantColor?: string;
	sensitiveContent: SensitiveContentResponse[];
	chapter: {
		id: string;
		title: string;
		index: number;
	};
	pageIndex: number;
	updatedAt: Date;
}

@Component({
	selector: 'app-latest-reads',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		ButtonComponent,
		IconsComponent,
		NgOptimizedImage,
		BlurhashComponent,
	],
	templateUrl: './latest-reads.component.html',
	styleUrl: './latest-reads.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LatestReadsComponent implements OnInit {
	private bookService = inject(BookService);
	private readingProgressService = inject(ReadingProgressService);
	private metaService = inject(MetaDataService);
	private sensitiveContentService = inject(SensitiveContentService);

	historyEntries = signal<HistoryEntry[]>([]);
	isLoading = signal(true);
	showSensitiveContent = signal(false);

	filteredHistory = computed(() => {
		const entries = this.historyEntries();
		const allowedNames = this.sensitiveContentService.allowContentSignal();

		return entries.filter((entry) => {
			if (!this.showSensitiveContent()) {
				const bookSensitive = entry.sensitiveContent || [];
				if (bookSensitive.length > 0) {
					return bookSensitive.every((sc) =>
						allowedNames.includes(sc.name),
					);
				}
			}
			return true;
		});
	});

	groupedHistory = computed(() => {
		const dateGroups = new Map<string, Map<string, HistoryEntry[]>>();

		for (const entry of this.filteredHistory()) {
			const dateStr = this.formatDateGroup(entry.updatedAt);

			if (!dateGroups.has(dateStr)) {
				dateGroups.set(dateStr, new Map<string, HistoryEntry[]>());
			}

			const bookGroups = dateGroups.get(dateStr);
			if (!bookGroups) continue;

			if (!bookGroups.has(entry.bookId)) {
				bookGroups.set(entry.bookId, []);
			}
			bookGroups.get(entry.bookId)?.push(entry);
		}

		return Array.from(dateGroups.entries()).map(([date, booksMap]) => ({
			date,
			books: Array.from(booksMap.entries()).map(([_, chapters]) => ({
				bookId: chapters[0].bookId,
				bookTitle: chapters[0].bookTitle,
				bookCover: chapters[0].bookCover,
				bookBlurHash: chapters[0].bookBlurHash,
				chapters,
			})),
		}));
	});

	ngOnInit() {
		this.setMetaData();
		this.loadHistory();
	}

	private setMetaData() {
		this.metaService.setMetaData({
			title: 'Histórico de Leitura',
			description: 'Veja os capítulos que você leu recentemente.',
		});
	}

	toggleSensitiveContent() {
		this.showSensitiveContent.update((v) => !v);
	}

	private async loadHistory() {
		this.isLoading.set(true);
		try {
			const progressList =
				await this.readingProgressService.getAllProgress();
			if (progressList && progressList.length > 0) {
				const sortedProgress = progressList
					.sort(
						(a, b) =>
							new Date(b.updatedAt).getTime() -
							new Date(a.updatedAt).getTime(),
					)
					.slice(0, 100);

				const results: HistoryEntry[] = [];
				const bookCache = new Map<string, BookBasic>();
				const chapterCache = new Map<string, Chapterlist[]>();

				for (const p of sortedProgress) {
					try {
						const entry = await this.processProgressEntry(
							p,
							bookCache,
							chapterCache,
						);
						if (entry) {
							results.push(entry);
						}
					} catch (err) {
						console.error(
							`Erro ao carregar histórico para o livro ${p.bookId}:`,
							err,
						);
					}
				}
				this.historyEntries.set(results);
			}
		} catch (e) {
			console.error('Erro ao carregar histórico:', e);
		} finally {
			this.isLoading.set(false);
		}
	}

	private async processProgressEntry(
		p: ReadingProgress,
		bookCache: Map<string, BookBasic>,
		chapterCache: Map<string, Chapterlist[]>,
	): Promise<HistoryEntry | null> {
		let bookBasic = bookCache.get(p.bookId);
		if (!bookBasic) {
			bookBasic = await firstValueFrom(
				this.bookService.getBook(p.bookId),
			);
			if (bookBasic) bookCache.set(p.bookId, bookBasic);
		}

		if (!bookBasic) return null;

		let chapters = chapterCache.get(p.bookId);
		if (!chapters) {
			const chaptersPage = await firstValueFrom(
				this.bookService.getChapters(p.bookId, { limit: 500 }),
			);
			chapters = chaptersPage.data;
			chapterCache.set(p.bookId, chapters);
		}

		const currentChapter = chapters.find((c) => c.id === p.chapterId);
		if (!currentChapter) return null;

		const index = currentChapter.index + 1;
		const chapterTitle = currentChapter.title
			? `Cap. ${index}: ${currentChapter.title}`
			: `Capítulo ${index}`;

		return {
			progressId: p.id || '',
			bookId: bookBasic.id,
			bookTitle: bookBasic.title,
			bookCover: bookBasic.cover,
			bookBlurHash: bookBasic.blurHash,
			bookDominantColor: bookBasic.dominantColor,
			sensitiveContent: bookBasic.sensitiveContent,
			chapter: {
				id: currentChapter.id,
				title: chapterTitle,
				index: currentChapter.index,
			},
			pageIndex: p.pageIndex,
			updatedAt: new Date(p.updatedAt),
		};
	}

	formatDateGroup(d: Date): string {
		const now = new Date();
		const today = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		);
		const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
		const diff = today.getTime() - target.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return 'Hoje';
		if (days === 1) return 'Ontem';

		const options: Intl.DateTimeFormatOptions = {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		};
		return target.toLocaleDateString('pt-BR', options);
	}

	formatTime(d: Date): string {
		return d.toLocaleTimeString('pt-BR', {
			hour: '2-digit',
			minute: '2-digit',
		});
	}
}
