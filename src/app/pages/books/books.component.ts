import { Component, Inject } from '@angular/core';
import { BookService } from '../../service/book.service';
import { BookList } from '../../models/booke.models';
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
  constructor(private booksService: BookService) {
    this.booksService.getBooks().subscribe((bookPage: Page<BookList>) => {
      this.books = bookPage.data;
    });
  }
}
