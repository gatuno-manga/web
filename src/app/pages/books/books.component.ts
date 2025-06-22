import { Component, Inject } from '@angular/core';
import { BookService } from '../../service/book.service';
import { BookList } from '../../models/booke.models';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-books',
  imports: [RouterModule],
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss'
})
export class BooksComponent {
  books: BookList[] = [];
  constructor(private booksService: BookService) {
    this.booksService.getBooks().subscribe((books: BookList[]) => {
      this.books = books;
    });
  }
}
