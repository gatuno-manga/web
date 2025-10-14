import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Book, BookBasic, BookDetail, BookList, BookPageOptions, Chapterlist, Cover, TagResponse } from "../models/book.models";
import { Page } from "../models/miscellaneous.models";
import { SensitiveContentService } from "./sensitive-content.service";
import { UserTokenService } from "./user-token.service";
import { BookWebsocketService } from "./book-websocket.service";

@Injectable({
  providedIn: 'root'
})
export class BookService {
  constructor(
    private readonly http: HttpClient,
    private readonly sensitiveContentService: SensitiveContentService,
    private readonly userTokenService: UserTokenService,
    private readonly websocketService: BookWebsocketService
  ) {
    // Conecta ao WebSocket após um pequeno delay para garantir que o backend está pronto
    // Apenas no browser (não no SSR)
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        try {
          this.websocketService.connect();
        } catch (error) {
          console.warn('Falha ao conectar WebSocket:', error);
          // WebSocket é opcional, não deve quebrar a aplicação
        }
      }, 2000);
    }
  }

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

  selectCover(bookId: string, coverId: string) {
    return this.http.patch<Book>(`books/${bookId}/covers/${coverId}/selected`, {});
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

  /**
   * Retorna os observables do WebSocket para eventos em tempo real
   */
  getWebsocketService() {
    return this.websocketService;
  }

  /**
   * Observa eventos de um livro específico
   */
  watchBook(bookId: string) {
    return this.websocketService.watchBook(bookId);
  }
}
