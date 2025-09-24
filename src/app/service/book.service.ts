import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Book, BookBasic, BookDetail, BookList, BookPageOptions, Chapterlist, Cover, TagResponse } from "../models/book.models";
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

    if (!this.userTokenService.hasToken && !this.userTokenService.hasValidRefreshToken)
      opts.sensitiveContent = [];

    return this.http.get<Page<BookList>>('books', {
      params: { ...opts }
    });
  }

  getBook(id: string) {
    return this.http.get<BookBasic>(`books/${id}`);
  }

  getChapters(bookId: string) {
    return this.http.get<Chapterlist[]>(`books/${bookId}/chapters`);
  }

  getCovers(bookId: string) {
    return this.http.get<Cover[]>(`books/${bookId}/covers`);
  }

  getInfo(bookId: string) {
    return this.http.get<BookDetail>(`books/${bookId}/infos`);
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
