import { Component, OnInit, signal, computed, inject, OnDestroy } from '@angular/core';
import { MetaDataService } from '@core/services/meta-data.service';
import { BookService } from '@core/services/book.service';
import { ReadingProgressService } from '@core/services/reading-progress.service';
import { BookList } from '@models/book.models';
import { ItemBookComponent } from '@features/books/components/item-book/item-book.component';
import { BookGridComponent } from '@ui/organisms/book-grid/book-grid.component';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [BookGridComponent, BlurhashComponent, CommonModule, RouterModule, NgOptimizedImage, ItemBookComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private metaService = inject(MetaDataService);
  private bookService = inject(BookService);
  private readingProgressService = inject(ReadingProgressService);

  featuredBooks = signal<BookList[]>([]);
  continueReadingBooks = signal<BookList[]>([]);
  latestUpdatedBooks = signal<BookList[]>([]);
  recentlyAddedBooks = signal<BookList[]>([]);
  
  isLoadingGrid = signal(true);
  isLoadingFeatured = signal(true);
  isLoadingRecentlyAdded = signal(true);

  currentFeaturedIndex = signal(0);
  private carouselInterval?: any;

  constructor() {
    this.setMetaData();
  }

  ngOnInit() {
    this.loadFeaturedBooks();
    this.loadContinueReading();
    this.loadLatestUpdated();
    this.loadRecentlyAdded();
    this.startCarousel();
  }

  ngOnDestroy() {
    this.stopCarousel();
  }

  setMetaData() {
    this.metaService.setMetaData({
      title: 'Home',
      description: 'Bem-vindo ao Gatuno. Explore os últimos lançamentos e continue sua leitura.',
    });
  }

  async loadFeaturedBooks() {
    this.isLoadingFeatured.set(true);
    try {
      const res = await firstValueFrom(this.bookService.getBooks({ limit: 5, orderBy: 'updatedAt', order: 'DESC' }));
      this.featuredBooks.set(res.data);
    } catch (e) {
      console.error('Error loading featured books', e);
    } finally {
      this.isLoadingFeatured.set(false);
    }
  }

  async loadContinueReading() {
    try {
      const progress = await this.readingProgressService.getAllProgress();
      if (progress.length > 0) {
        // Sort by updatedAt DESC and get unique bookIds
        const sortedProgress = [...progress].sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        
        const bookIds = [...new Set(sortedProgress.map(p => p.bookId))].slice(0, 10);
        const books: BookList[] = [];
        
        for (const id of bookIds) {
          const book = await firstValueFrom(this.bookService.getBook(id));
          if (book) {
            books.push({
              id: book.id,
              title: book.title,
              cover: book.cover,
              description: book.description,
              tags: book.tags,
              scrapingStatus: book.scrapingStatus,
              blurHash: book.blurHash,
              dominantColor: book.dominantColor,
              metadata: book.metadata
            });
          }
        }
        this.continueReadingBooks.set(books);
      }
    } catch (e) {
      console.error('Error loading continue reading', e);
    }
  }

  async loadLatestUpdated() {
    this.isLoadingGrid.set(true);
    try {
      const res = await firstValueFrom(this.bookService.getBooks({ 
        limit: 12,
        orderBy: 'updatedAt',
        order: 'DESC'
      }));
      this.latestUpdatedBooks.set(res.data);
    } catch (e) {
      console.error('Error loading latest updated books', e);
    } finally {
      this.isLoadingGrid.set(false);
    }
  }

  async loadRecentlyAdded() {
    this.isLoadingRecentlyAdded.set(true);
    try {
      const res = await firstValueFrom(this.bookService.getBooks({ 
        limit: 12,
        orderBy: 'createdAt',
        order: 'DESC'
      }));
      this.recentlyAddedBooks.set(res.data);
    } catch (e) {
      console.error('Error loading recently added books', e);
    } finally {
      this.isLoadingRecentlyAdded.set(false);
    }
  }

  startCarousel() {
    if (typeof window !== 'undefined') {
      this.carouselInterval = setInterval(() => {
        this.nextFeatured();
      }, 8000);
    }
  }

  stopCarousel() {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
    }
  }

  nextFeatured() {
    if (this.featuredBooks().length > 0) {
      this.currentFeaturedIndex.update(idx => (idx + 1) % this.featuredBooks().length);
    }
  }

  setFeatured(index: number) {
    this.currentFeaturedIndex.set(index);
    this.stopCarousel();
    this.startCarousel();
  }
}

