import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Book, BookList, BookPageOptions, Chapter, SensitiveContent } from "../models/book.models";
import { Page } from "../models/miscellaneous.models";

@Injectable({
  providedIn: 'root'
})
export class BookService {
  constructor(private http: HttpClient) {}

  getBooks(opitions?: BookPageOptions) {
    return this.http.get<Page<BookList>>('books', {
      params: {
        ...opitions,
      }
    });
  }

  getBook(id: string) {
    return this.http.get<Book>(`books/${id}`);
  }
}
