import { HttpClient } from "@angular/common/http";
import { Injectable, NgZone } from "@angular/core";
import { Book, BookBasic, BookDetail, BookList, BookPageOptions, Chapterlist, Cover, TagResponse, UpdateBookDto, ScrapingStatus } from "../models/book.models";
import { Page } from "../models/miscellaneous.models";
import { SensitiveContentService } from "./sensitive-content.service";
import { UserTokenService } from "./user-token.service";
import { BookWebsocketService } from "./book-websocket.service";
import { DownloadService } from "./download.service";
import { Observable, from, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private readonly apiUrl = '/api';

  constructor(
    private readonly http: HttpClient,
    private readonly sensitiveContentService: SensitiveContentService,
    private readonly userTokenService: UserTokenService,
    private readonly websocketService: BookWebsocketService,
    private readonly downloadService: DownloadService,
    private readonly ngZone: NgZone
  ) {
    if (typeof window !== 'undefined') {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          try {
            if (this.userTokenService.hasValidAccessToken) {
              this.websocketService.connect();
            }
          } catch (error) {
            console.warn('Falha ao conectar WebSocket:', error);
          }
        }, 2000);
      });
    }
  }

  getBooks(options?: BookPageOptions) {
    const opts = { ...options };

    if (!opts.sensitiveContent)
      opts.sensitiveContent = this.sensitiveContentService.getContentAllow();

    if (!this.userTokenService.hasValidAccessToken && !this.userTokenService.hasValidRefreshToken)
      opts.sensitiveContent = [];

    return this.http.get<Page<BookList>>('books', {
      params: { ...opts }
    }).pipe(
      catchError((err) => {
        console.warn('Online fetch failed, falling back to offline mode', err);
        return this.getOfflineBooks(options);
      })
    );
  }

  getOfflineBooks(options?: BookPageOptions): Observable<Page<BookList>> {
    const opts = { ...options };
    
    return from(this.downloadService.getAllBooks()).pipe(
      map(books => {
        let filteredBooks = books;

        // 1. Filtrar por Conteúdo Sensível
        // Recarrega as preferências se estiver offline, ignorando estado do token
        const allowedContent = this.sensitiveContentService.getContentAllow();

        filteredBooks = filteredBooks.filter(book => {
          // Se o livro não tem conteúdo sensível, é permitido
          if (!book.sensitiveContent || book.sensitiveContent.length === 0) return true;
          
          // Verifica se TODOS os conteúdos sensíveis do livro estão na lista permitida
          const isAllowed = book.sensitiveContent.every(sc => 
              allowedContent.includes(sc.name) || allowedContent.includes(sc.id)
          );
          
          return isAllowed;
        });

        // 2. Filtrar por Pesquisa (Título)
        if (opts.search) {
          const term = opts.search.toLowerCase();
          filteredBooks = filteredBooks.filter(book =>
            book.title.toLowerCase().includes(term)
          );
        }

        // 3. Filtrar por Tags
        if (opts.tags && opts.tags.length > 0) {
          filteredBooks = filteredBooks.filter(book => {
            const tags = book.tags || [];
            const bookTagIds = tags.map(t => t.id);
            const bookTagNames = tags.map(t => t.name);
            
            const checkTag = (tag: string) => bookTagIds.includes(tag) || bookTagNames.includes(tag);

            if (opts.tagsLogic === 'or') {
              return opts.tags!.some(checkTag);
            }
            return opts.tags!.every(checkTag);
          });
        }

        // Mapear para BookList
        const data: BookList[] = filteredBooks.map(book => ({
          id: book.id,
          title: book.title,
          tags: book.tags || [],
          cover: (book.cover instanceof Blob) ? URL.createObjectURL(book.cover) : '',
          description: book.description,
          scrapingStatus: ScrapingStatus.READY // Livros offline estão sempre "prontos"
        }));

        // Simular paginação (retornando tudo por enquanto ou implementando slice se necessário)
        // Para offline, geralmente retorna tudo ou aplica paginação simples em memória
        const page = opts.page || 1;
        const limit = opts.limit || 50;
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
          data: data.slice(start, end),
          metadata: {
            total: data.length,
            page: page,
            lastPage: Math.ceil(data.length / limit)
          }
        };
      })
    );
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

  updateCover(bookId: string, coverId: string, data: { title: string; }) {
    return this.http.patch<Cover>(`books/${bookId}/covers/${coverId}`, data);
  }

  orderCovers(bookId: string, covers: { id: string; index: number; }[]) {
    return this.http.patch<void>(`books/${bookId}/covers/order`, covers);
  }

  uploadCover(bookId: string, file: File, title?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }
    return this.http.post<Cover>(`books/${bookId}/covers/upload`, formData);
  }

  replaceCoverImage(bookId: string, coverId: string, file: File, title?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }
    return this.http.patch<Cover>(`books/${bookId}/covers/${coverId}/image`, formData);
  }

  deleteCover(bookId: string, coverId: string) {
    return this.http.delete<void>(`books/${bookId}/covers/${coverId}`);
  }

  getInfo(bookId: string) {
    return this.http.get<BookDetail>(`books/${bookId}/infos`);
  }

  updateBook(bookId: string, data: UpdateBookDto) {
    return this.http.patch<Book>(`books/${bookId}`, data);
  }

  fixBook(id: string) {
    return this.http.patch<Book>(`books/${id}/fix`, {});
  }

  resetBook(id: string) {
    return this.http.patch<Book>(`books/${id}/reset`, {});
  }

  checkUpdates(id: string) {
    return this.http.post<{ message: string; bookId: string; }>(`books/${id}/check-updates`, {});
  }

  toggleAutoUpdate(id: string, enabled: boolean) {
    return this.http.patch<{ id: string; title: string; autoUpdate: boolean; }>(`books/${id}/auto-update`, { enabled });
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

  /**
   * Faz download de um livro usando Fetch API com streaming real
   * Processa chunks à medida que chegam, evitando OOM em arquivos grandes (>900MB)
   * @param bookId ID do livro
   * @param format Formato do download (images ou pdfs)
   * @param chapterIds IDs dos capítulos (opcional, vazio = todos)
   * @returns Observable que emite eventos de progresso e o blob final
   */
  downloadBook(bookId: string, format: 'images' | 'pdfs', chapterIds?: string[]): Observable<{
    progress?: number;
    loaded?: number;
    total?: number;
    blob?: Blob;
  }> {
    return new Observable(observer => {
      // Usar token do UserTokenService (mesma lógica do interceptor)
      const token = this.userTokenService.accessToken;

      // Construir URL completa usando environment (mesma lógica do interceptor)
      const baseUrl = environment.apiURL || (window.location.origin + '/api');
      const url = `${baseUrl.replace(/\/+$/, '')}/books/${bookId}/download`;

      console.log('Fetch download URL:', url);

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          chapterIds: chapterIds || [],
          format: format === 'pdfs' ? 'pdfs' : 'images'
        })
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // Extrair Content-Length para progresso
          const contentLength = response.headers.get('Content-Length');
          const total = contentLength ? parseInt(contentLength, 10) : 0;

          if (!response.body) {
            throw new Error('ReadableStream não suportado');
          }

          const reader = response.body.getReader();
          const chunks: Uint8Array<ArrayBuffer>[] = [];
          let loaded = 0;

          // Função recursiva para ler chunks
          const readChunk = (): Promise<void> => {
            return reader.read().then(({ done, value }) => {
              if (done) {
                // Stream completo - montar blob
                const blob = new Blob(chunks, { type: 'application/zip' });
                observer.next({ blob, progress: 100, loaded, total });
                observer.complete();
                return;
              }

              if (value) {
                // Chunk recebido
                chunks.push(value as Uint8Array<ArrayBuffer>);
                loaded += value.length;
              }

              // Emitir progresso
              const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
              observer.next({ progress, loaded, total });

              // Continuar lendo
              return readChunk();
            });
          };

          return readChunk();
        })
        .catch(error => {
          console.error('Fetch streaming error:', error);
          observer.error(error);
        });
    });
  }

  randomBook(options: BookPageOptions = {}) {
    const opts = { ...options };
    if (!opts.sensitiveContent)
      opts.sensitiveContent = this.sensitiveContentService.getContentAllow();
    if (!this.userTokenService.hasValidAccessToken && !this.userTokenService.hasValidRefreshToken)
      opts.sensitiveContent = [];
    return this.http.get<{ id: string }>('books/random', {
      params: { ...opts }
    });
  }
}