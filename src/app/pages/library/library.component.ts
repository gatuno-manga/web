import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollectionService } from '@core/services/collection.service';
import { BookInteractionService } from '@core/services/book-interaction.service';
import { BookService } from '@core/services/book.service';
import { Collection } from '@core/models/collection.models';
import { ItemBookComponent } from '@features/books/components/item-book/item-book.component';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, ItemBookComponent, IconsComponent],
  templateUrl: './library.component.html',
  styleUrl: './library.component.scss',
})
export class LibraryComponent implements OnInit {
  private collectionService = inject(CollectionService);
  private interactionService = inject(BookInteractionService);
  private bookService = inject(BookService);

  collections = signal<Collection[]>([]);
  selectedCollection = signal<Collection | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  selectCollection(collection: Collection) {
    if (!collection.books || collection.books.length === 0) {
      this.selectedCollection.set(collection);
      return;
    }

    const bookIds = collection.books
      .map((b: any) => typeof b === 'string' ? b : (b?.bookId || b?.book?.id || b?.id))
      .filter(id => !!id);

    this.isLoading.set(true);
    this.bookService.getBooks({ ids: bookIds }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (res) => {
        const fullCollection = { ...collection, books: res.data };
        this.selectedCollection.set(fullCollection);
      },
      error: (err) => {
        console.error('Erro ao buscar detalhes dos livros, usando dados cacheados', err);
        this.selectedCollection.set(collection);
      }
    });
  }

  clearSelection() {
    this.selectedCollection.set(null);
  }

  ngOnInit() {
    this.fetchData();
  }

  private fetchData() {
    this.isLoading.set(true);
    this.error.set(null);

    // Fetch collections
    this.collectionService.getMyCollections().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (colls) => {
        this.collections.set(colls);
      },
      error: (err) => {
        console.error('Erro ao buscar coleções', err);
        this.error.set('Não foi possível carregar a biblioteca. Tente novamente mais tarde.');
        this.isLoading.set(false);
      }
    });
  }
}
