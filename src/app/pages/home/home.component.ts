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
import { ImageFallbackDirective } from '@ui/directives/image-fallback.directive';
import { firstValueFrom } from 'rxjs';

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
		ImageFallbackDirective,
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

	constructor() {
		this.setMetaData();

		// Re-carrega livros quando filtros globais mudam
		effect(() => {
			this.sensitiveContentService.allowContentSignal();
			this.tagsService.excludedTagsSignal();

			this.loadAllData();
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

	/** Busca todos os livros necessários para a home em uma única requisição GraphQL.
	 * Isso substitui as chamadas individuais, eliminando até 12 requisições separadas.
	 */
	async loadAllData() {
		this.isLoadingFeatured.set(true);
		this.isLoadingGrid.set(true);
		this.isLoadingContinueReading.set(true);
		this.isLoadingRecentlyAdded.set(true);

		try {
			// 1. Obter IDs do histórico de leitura local
			const progress = await this.readingProgressService.getAllProgress();
			const bookIds =
				progress.length === 0
					? []
					: [
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

			// 2. Fazer uma única chamada GraphQL com tudo
			const res = await firstValueFrom(
				this.bookService.getHomeBooksData(bookIds),
			);

			this.featuredBooks.set(res.latestUpdated.slice(0, 5));
			this.latestUpdatedBooks.set(res.latestUpdated);
			this.recentlyAddedBooks.set(res.recentlyAdded);
			this.continueReadingBooks.set(res.continueReading);
		} catch (e) {
			console.error('Error loading all home data', e);
		} finally {
			this.isLoadingFeatured.set(false);
			this.isLoadingGrid.set(false);
			this.isLoadingContinueReading.set(false);
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
