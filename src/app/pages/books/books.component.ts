import { Component, Inject } from '@angular/core';
import { BookService } from '../../service/book.service';
import { BookList } from '../../models/book.models';
import { RouterModule } from '@angular/router';
import { Page } from '../../models/miscellaneous.models';

@Component({
  selector: 'app-books',
  imports: [RouterModule],
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss'
})
export class BooksComponent {
  books: BookList[] = [];
  currentPage = 1;
  lastPage = 1;
  pagesToShow: number[] = [];

  constructor(private booksService: BookService) {
    this.loadBooks(this.currentPage);
  }

  loadBooks(page: number) {
    this.booksService.getBooks({ page }).subscribe((bookPage: Page<BookList>) => {
      this.books = bookPage.data;
      this.currentPage = bookPage.metadata.page;
      this.lastPage = bookPage.metadata.lastPage;
      this.pagesToShow = this.getPagesToShow();
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
}
