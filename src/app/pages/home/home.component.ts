import { NgOptimizedImage } from '@angular/common';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	effect,
	inject,
	signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { MetaDataService } from '@core/services/meta-data.service';
import { ReadingProgressService } from '@core/services/reading-progress.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { TagsService } from '@core/services/tags.service';
import { ItemBookComponent } from '@features/books/components/item-book/item-book.component';
import { BookList } from '@models/book.models';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';
import { BookGridComponent } from '@ui/organisms/book-grid/book-grid.component';
import { firstValueFrom, forkJoin } from 'rxjs';

@Component({
	selector: 'app-home',
	standalone: true,
	imports: [
		BookGridComponent,
		BlurhashComponent,
		RouterModule,
		NgOptimizedImage,
		ItemBookComponent,
		ButtonComponent,
	],
	templateUrl: './home.component.html',
	styleUrl: './home.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
	private metaService = inject(MetaDataService);
	private bookService = inject(BookService);
	private readingProgressService = inject(ReadingProgressService);
	private sensitiveContentService = inject(SensitiveContentService);
	private tagsService = inject(TagsService);
	private destroyRef = inject(DestroyRef);

	featuredBooks = signal<BookList[]>([]);
	continueReadingBooks = signal<BookList[]>([]);
	latestUpdatedBooks = signal<BookList[]>([]);
	recentlyAddedBooks = signal<BookList[]>([]);

	isLoadingGrid = signal(true);
	isLoadingFeatured = signal(true);
	isLoadingRecentlyAdded = signal(true);
	isLoadingContinueReading = signal(false);

	currentFeaturedIndex = signal(0);
	private carouselInterval?: ReturnType<typeof setInterval>;

	coverImageErrors = signal<Set<string>>(new Set());

	onImageError(bookId: string) {
		this.coverImageErrors.update((errors) => {
			const newErrors = new Set(errors);
			newErrors.add(bookId);
			return newErrors;
		});
	}

	hasImageError(bookId: string): boolean {
		return this.coverImageErrors().has(bookId);
	}

	constructor() {
		this.setMetaData();
		this.loadContinueReading();

		// Re-carrega livros quando filtros globais mudam
		effect(() => {
			this.sensitiveContentService.allowContentSignal();
			this.tagsService.excludedTagsSignal();

			this.loadBooksData();
			this.loadRecentlyAdded();
		});

		// Inicia o carousel apenas no browser (SSR safe) com cleanup automático
		afterNextRender(() => {
			this.startCarousel();
			this.destroyRef.onDestroy(() => this.stopCarousel());
		});
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Home',
			description:
				'Bem-vindo ao Gatuno. Explore os últimos lançamentos e continue sua leitura.',
		});
	}

	/** Busca os livros mais recentemente atualizados.
	 * Usa os primeiros 5 para o carousel featured e todos os 12 para o grid,
	 * economizando uma request HTTP.
	 */
	async loadBooksData() {
		this.isLoadingFeatured.set(true);
		this.isLoadingGrid.set(true);
		try {
			const res = await firstValueFrom(
				this.bookService.getBooks({
					limit: 12,
					orderBy: 'updatedAt',
					order: 'DESC',
				}),
			);
			this.featuredBooks.set(res.data.slice(0, 5));
			this.latestUpdatedBooks.set(res.data);
		} catch (e) {
			console.error('Error loading books data', e);
		} finally {
			this.isLoadingFeatured.set(false);
			this.isLoadingGrid.set(false);
		}
	}

	async loadContinueReading() {
		this.isLoadingContinueReading.set(true);
		try {
			const progress = await this.readingProgressService.getAllProgress();
			if (progress.length === 0) return;

			// Ordena por updatedAt DESC e pega IDs únicos
			const bookIds = [
				...new Set(
					[...progress]
						.sort(
							(a, b) =>
								new Date(b.updatedAt).getTime() -
								new Date(a.updatedAt).getTime(),
						)
						.map((p) => p.bookId),
				),
			].slice(0, 10);

			// forkJoin: todas as requests em paralelo (elimina N+1)
			const bookResponses = await firstValueFrom(
				forkJoin(bookIds.map((id) => this.bookService.getBook(id))),
			);

			const books: BookList[] = bookResponses
				.filter(Boolean)
				.map((book) => ({
					id: book?.id,
					title: book?.title,
					cover: book?.cover,
					description: book?.description,
					tags: book?.tags,
					scrapingStatus: book?.scrapingStatus,
					blurHash: book?.blurHash,
					dominantColor: book?.dominantColor,
					metadata: book?.metadata,
				}));

			this.continueReadingBooks.set(books);
		} catch (e) {
			console.error('Error loading continue reading', e);
		} finally {
			this.isLoadingContinueReading.set(false);
		}
	}

	async loadRecentlyAdded() {
		this.isLoadingRecentlyAdded.set(true);
		try {
			const res = await firstValueFrom(
				this.bookService.getBooks({
					limit: 12,
					orderBy: 'createdAt',
					order: 'DESC',
				}),
			);
			this.recentlyAddedBooks.set(res.data);
		} catch (e) {
			console.error('Error loading recently added books', e);
		} finally {
			this.isLoadingRecentlyAdded.set(false);
		}
	}

	startCarousel() {
		this.carouselInterval = setInterval(() => {
			this.nextFeatured();
		}, 8000);
	}

	stopCarousel() {
		if (this.carouselInterval) {
			clearInterval(this.carouselInterval);
			this.carouselInterval = undefined;
		}
	}

	pauseCarousel() {
		this.stopCarousel();
	}

	resumeCarousel() {
		this.stopCarousel();
		this.startCarousel();
	}

	nextFeatured() {
		if (this.featuredBooks().length > 0) {
			this.currentFeaturedIndex.update(
				(idx) => (idx + 1) % this.featuredBooks().length,
			);
		}
	}

	setFeatured(index: number) {
		this.currentFeaturedIndex.set(index);
		this.stopCarousel();
		this.startCarousel();
	}
}
