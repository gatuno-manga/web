import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Book, BookList, BookPageOptions, Chapter, SensitiveContent } from "../models/book.models";
import { Page } from "../models/miscellaneous.models";
import { SensitiveContentService } from "./sensitive-content.service";

@Injectable({
  providedIn: 'root'
})
export class BookService {
  constructor(
    private readonly http: HttpClient,
    private readonly sensitiveContentService: SensitiveContentService,
  ) {}
  getBooks(options?: BookPageOptions) {
    const opts = { ...options };

    if (!opts.sensitiveContent) {
      opts.sensitiveContent = this.sensitiveContentService.getContentAllow();
    }

    return this.http.get<Page<BookList>>('books', {
      params: { ...opts }
    });
  }

  getBook(id: string) {
    return this.http.get<Book>(`books/${id}`);
  }
}
