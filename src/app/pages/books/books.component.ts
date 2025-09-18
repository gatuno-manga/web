import { Component, signal } from '@angular/core';
import { LocalStorageService } from '../../service/local-storage.service';
import { BookService } from '../../service/book.service';
import { BookList } from '../../models/book.models';
import { RouterModule } from '@angular/router';
import { ItemBookComponent } from '../../components/item-book/item-book.component';
import { Page } from '../../models/miscellaneous.models';
import { SelectComponent } from '../../components/select/select.component';

@Component({
  selector: 'app-books',
  imports: [RouterModule, ItemBookComponent, SelectComponent],
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss'
})
export class BooksComponent {
  books: BookList[] = [];
  currentPage = 1;
  lastPage = 1;
  pagesToShow: number[] = [];
  isLoading = signal(true);
  bookOptions: 'grid' | 'list' = 'grid';
  selectList = [
    {
      icon: 'grid',
      checked: () => this.setBookOptions('grid'),
    },
    {
      icon: 'list',
      checked: () => this.setBookOptions('list'),
    }
  ];

  constructor(
    private booksService: BookService,
    private localStorage: LocalStorageService
  ) {
    const savedLayout = this.localStorage.get('books-layout');
    if (savedLayout === 'grid' || savedLayout === 'list') {
      this.bookOptions = savedLayout;
    }
    this.loadBooks(this.currentPage);
  }

  setBookOptions(option: 'grid' | 'list') {
    this.bookOptions = option;
    this.localStorage.set('books-layout', option);
  }

  loadBooks(page: number) {
    this.booksService.getBooks({ page }).subscribe((bookPage: Page<BookList>) => {
      this.books = bookPage.data;
      this.currentPage = bookPage.metadata.page;
      this.lastPage = bookPage.metadata.lastPage;
      this.pagesToShow = this.getPagesToShow();
      this.isLoading.set(false);
    });
  }

  getPagesToShow(): number[] {
    const pages = new Set<number>();
    pages.add(1);
    pages.add(this.lastPage);

    for (let i = this.currentPage - 2; i <= this.currentPage + 2; i++) {
      if (i > 1 && i < this.lastPage) {
        pages.add(i);
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  goToPage(page: number) {
    if (page !== this.currentPage && page >= 1 && page <= this.lastPage) {
      this.loadBooks(page);
    }
  }

  selectListItem(): number {
    return this.selectList.findIndex(item => item.icon === this.bookOptions);
  }
}
