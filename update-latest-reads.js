const fs = require('node:fs');
const file = 'src/app/pages/latest-reads/latest-reads.component.ts';
let content = fs.readFileSync(file, 'utf8');

// Inject ChapterService
content = content.replace(
	"import { BookService } from '@core/services/book.service';",
	"import { BookService } from '@core/services/book.service';\nimport { ChapterService } from '@core/services/chapter.service';\nimport { Chapter } from '@models/book.models';",
);

content = content.replace(
	'private bookService = inject(BookService);',
	'private bookService = inject(BookService);\n\tprivate chapterService = inject(ChapterService);',
);

// Rewrite loadHistory and processProgressEntry
const newLoadHistory = `	private async loadHistory() {
		this.isLoading.set(true);
		try {
			const progressList = await this.readingProgressService.getAllProgress();
			if (progressList && progressList.length > 0) {
				const sortedProgress = progressList
					.sort(
						(a, b) =>
							new Date(b.updatedAt).getTime() -
							new Date(a.updatedAt).getTime(),
					)
					.slice(0, 100);

				const uniqueBookIds = [...new Set(sortedProgress.map(p => p.bookId))];
				const uniqueChapterIds = [...new Set(sortedProgress.map(p => p.chapterId))];

				// Fetch chapters in batch
				let chaptersMap = new Map<string, Chapter>();
				try {
					const chaptersBatch = await firstValueFrom(this.chapterService.getChaptersBatch(uniqueChapterIds));
					chaptersBatch.forEach((c: Chapter) => chaptersMap.set(c.id, c));
				} catch (e) {
					console.error('Erro ao buscar capítulos em batch:', e);
				}

				// Fetch books concurrently with a concurrency limit
				const bookCache = new Map<string, BookBasic>();
				const chunkSize = 10;
				for (let i = 0; i < uniqueBookIds.length; i += chunkSize) {
					const chunk = uniqueBookIds.slice(i, i + chunkSize);
					await Promise.all(chunk.map(async bookId => {
						try {
							const bookBasic = await firstValueFrom(this.bookService.getBook(bookId));
							if (bookBasic) bookCache.set(bookId, bookBasic);
						} catch (e) {
							console.error(\`Erro ao carregar livro \${bookId}:\`, e);
						}
					}));
				}

				const results: HistoryEntry[] = [];
				for (const p of sortedProgress) {
					try {
						const entry = this.buildProgressEntry(p, bookCache, chaptersMap);
						if (entry) {
							results.push(entry);
						}
					} catch (err) {
						console.error(
							\`Erro ao processar histórico para o livro \${p.bookId}:\`,
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

	private buildProgressEntry(
		p: ReadingProgress,
		bookCache: Map<string, BookBasic>,
		chaptersMap: Map<string, Chapter>,
	): HistoryEntry | null {
		const bookBasic = bookCache.get(p.bookId);
		if (!bookBasic) return null;

		const currentChapter = chaptersMap.get(p.chapterId);
		if (!currentChapter) return null;

		const index = currentChapter.index + 1;
		const chapterTitle = currentChapter.title
			? \`Cap. \${index}: \${currentChapter.title}\`
			: \`Capítulo \${index}\`;

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
	}`;

const startIdx = content.indexOf('private async loadHistory()');
const endIdx = content.indexOf('formatDateGroup(d: Date): string {');

if (startIdx > -1 && endIdx > -1) {
	content =
		content.substring(0, startIdx) +
		newLoadHistory +
		'\n\t' +
		content.substring(endIdx);
	fs.writeFileSync(file, content, 'utf8');
	console.log('Updated latest-reads.component.ts successfully.');
} else {
	console.log('Could not find blocks to replace.');
}
