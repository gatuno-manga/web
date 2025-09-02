import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Book, BookList, BookPageOptions, Chapter, SensitiveContentResponse, TagResponse } from "../models/book.models";
import { Page } from "../models/miscellaneous.models";
import { SensitiveContentService } from "./sensitive-content.service";
import { UserTokenService } from "./user-token.service";

@Injectable({
  providedIn: 'root'
})
export class BookService {
  constructor(
    private readonly http: HttpClient,
    private readonly sensitiveContentService: SensitiveContentService,
    private readonly userTokenService: UserTokenService
  ) {}
  getBooks(options?: BookPageOptions) {
    const opts = { ...options };

    if (!opts.sensitiveContent)
      opts.sensitiveContent = this.sensitiveContentService.getContentAllow();

    if (!this.userTokenService.hasToken)
      opts.sensitiveContent = [];

    return this.http.get<Page<BookList>>('books', {
      params: { ...opts }
    });
  }

  getBook(id: string) {
    return this.http.get<Book>(`books/${id}`);
  }

  getTags() {
    return this.http.get<TagResponse[]>('books/tags');
  }

  fixBook(id: string) {
    return this.http.patch<Book>(`books/${id}/fix`, {});
  }

  resetBook(id: string) {
    return this.http.patch<Book>(`books/${id}/reset`, {});
  }
}
