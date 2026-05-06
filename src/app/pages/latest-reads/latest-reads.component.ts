import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { ReadingProgressService } from '@core/services/reading-progress.service';
import { MetaDataService } from '@core/services/meta-data.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { BookList, Chapterlist } from '@models/book.models';
import { ItemBookComponent } from '@features/books/components/item-book/item-book.component';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { firstValueFrom } from 'rxjs';

interface BookWithProgress {
	book: BookList;
	progress: {
		currentChapterTitle?: string;
		nextChapterTitle?: string;
		nextChapterId?: string;
		pageIndex?: number;
	};
	updatedAt: Date;
}

@Component({
	selector: 'app-latest-reads',
	standalone: true,
	imports: [CommonModule, RouterModule, ItemBookComponent, IconsComponent],
	templateUrl: './latest-reads.component.html',
	styleUrl: './latest-reads.component.scss',
})
export class LatestReadsComponent implements OnInit {
	private bookService = inject(BookService);
	private readingProgressService = inject(ReadingProgressService);
	private metaService = inject(MetaDataService);
	private sensitiveContentService = inject(SensitiveContentService);

	allBooksWithProgress = signal<BookWithProgress[]>([]);
	isLoading = signal(true);
	viewMode = signal<'grid' | 'list'>('grid');
	showSensitiveContent = signal(false);

	filteredBooks = computed(() => {
		const books = this.allBooksWithProgress();
		const allowedIds = this.sensitiveContentService.getContentAllow();

		return books.filter((item) => {
			// Se o filtro estiver desativado, remove livros com conteúdo sensível
			// (Seguindo a lógica do BookService)
			if (!this.showSensitiveContent()) {
				const bookSensitive = (item.book as any).sensitiveContent || [];
				if (bookSensitive.length > 0) {
					return bookSensitive.every(
						(sc: any) =>
							allowedIds.includes(sc.id) ||
							allowedIds.includes(sc.name),
					);
				}
			}
			return true;
		});
	});

	ngOnInit() {
		this.setMetaData();
		this.loadLatestReads();
	}

	private setMetaData() {
		this.metaService.setMetaData({
			title: 'Últimas Leituras',
			description: 'Veja os livros que você começou a ler recentemente.',
		});
	}

	toggleViewMode() {
		this.viewMode.update((mode) => (mode === 'grid' ? 'list' : 'grid'));
	}

	toggleSensitiveContent() {
		this.showSensitiveContent.update((v) => !v);
	}

	async removeProgress(bookId: string) {
		try {
			// Buscar todos os capítulos desse livro que têm progresso
			const progress = await this.readingProgressService.getAllProgress();
			const bookProgress = progress.filter((p) => p.bookId === bookId);

			for (const p of bookProgress) {
				await this.readingProgressService.deleteProgress(p.chapterId);
			}

			// Atualizar lista local
			this.allBooksWithProgress.update((list) =>
				list.filter((item) => item.book.id !== bookId),
			);
		} catch (err) {
			console.error('Erro ao remover progresso:', err);
		}
	}

	private async loadLatestReads() {
		this.isLoading.set(true);
		try {
			const progress = await this.readingProgressService.getAllProgress();
			if (progress && progress.length > 0) {
				// Agrupar progressos por livro para pegar o mais recente de cada um
				const latestByBook = new Map<string, any>();
				for (const p of progress) {
					const existing = latestByBook.get(p.bookId);
					if (
						!existing ||
						new Date(p.updatedAt).getTime() >
							new Date(existing.updatedAt).getTime()
					) {
						latestByBook.set(p.bookId, p);
					}
				}

				const sortedLatest = Array.from(latestByBook.values()).sort(
					(a, b) =>
						new Date(b.updatedAt).getTime() -
						new Date(a.updatedAt).getTime(),
				);

				const results: BookWithProgress[] = [];

				for (const p of sortedLatest) {
					try {
						const bookBasic = await firstValueFrom(
							this.bookService.getBook(p.bookId),
						);
						if (bookBasic) {
							// Buscar capítulos para encontrar o título e o próximo
							const chaptersPage = await firstValueFrom(
								this.bookService.getChapters(p.bookId, {
									limit: 500,
								}),
							);
							const chapters = chaptersPage.data;

							const currentIndex = chapters.findIndex(
								(c) => c.id === p.chapterId,
							);
							const currentChapter = chapters[currentIndex];
							const nextChapter = chapters[currentIndex + 1];

							const formatChapter = (c: Chapterlist | undefined) => {
								if (!c) return undefined;
								const index = c.index + 1;
								return c.title ? `Cap. ${index}: ${c.title}` : `Capítulo ${index}`;
							};

							results.push({
								book: {
									id: bookBasic.id,
									title: bookBasic.title,
									cover: bookBasic.cover,
									description: bookBasic.description,
									tags: bookBasic.tags,
									scrapingStatus: bookBasic.scrapingStatus,
									blurHash: bookBasic.blurHash,
									dominantColor: bookBasic.dominantColor,
									metadata: bookBasic.metadata,
									// biome-ignore lint/suspicious/noExplicitAny: needed for filtering
									sensitiveContent: (bookBasic as any)
										.sensitiveContent,
								} as any,
								progress: {
									currentChapterTitle: formatChapter(currentChapter),
									nextChapterTitle: formatChapter(nextChapter),
									nextChapterId: nextChapter?.id,
									pageIndex: p.pageIndex,
								},
								updatedAt: new Date(p.updatedAt),
							});
						}
					} catch (err) {
						console.error(
							`Erro ao carregar livro ${p.bookId}:`,
							err,
						);
					}
				}
				this.allBooksWithProgress.set(results);
			}
		} catch (e) {
			console.error('Erro ao carregar últimas leituras:', e);
		} finally {
			this.isLoading.set(false);
		}
	}
}
