import { Component, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BookBasic, Chapterlist, ScrapingStatus } from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { IconsComponent } from '../../components/icons/icons.component';
import { MetaDataService } from '../../service/meta-data.service';
import { UserTokenService } from '../../service/user-token.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { InfoBookComponent } from '../../components/info-book/info-book.component';
import { AsideComponent } from '../../components/aside/aside.component';
import { ButtonComponent } from '../../components/inputs/button/button.component';
import { BookWebsocketService } from '../../service/book-websocket.service';
import { DownloadService } from '../../service/download.service';
import { UnifiedReadingProgressService } from '../../service/unified-reading-progress.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-book',
  imports: [RouterModule, IconsComponent, InfoBookComponent, AsideComponent, ButtonComponent],
  templateUrl: './book.component.html',
  styleUrl: './book.component.scss',
})
export class BookComponent implements OnInit, OnDestroy {
  ScrapingStatus = ScrapingStatus;
  book!: BookBasic;
  admin = false;
  isLoading = signal(true);
  private wsSubscription?: Subscription;
  private coverUrl?: string;

  // Estado para "Continue lendo"
  lastReadChapterId: string | null = null;
  lastReadPage: number = 0;
  firstChapterId: string | null = null;

  // Estado para dropdown de opções
  showOptionsDropdown = signal(false);

  constructor(
    private bookService: BookService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private metaService: MetaDataService,
    private modalService: ModalNotificationService,
    private userTokenService: UserTokenService,
    private wsService: BookWebsocketService,
    private downloadService: DownloadService,
    private readingProgressService: UnifiedReadingProgressService
  ) {
    this.admin = this.userTokenService.isAdmin;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closeOptionsDropdown();
  }

  ngOnInit() {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      return;
    }

    this.bookService.getBook(id).subscribe({
      next: (book) => {
        if (!book) {
          this.router.navigate(['../'], { relativeTo: this.activatedRoute });
          return;
        }
        this.book = book;
        this.setMetaData();
        this.isLoading.set(false);

        // Carrega o último progresso de leitura
        this.loadLastReadingProgress();

        // Carrega o primeiro capítulo para "Começar a ler"
        this.loadFirstChapter();

        // Conecta ao WebSocket e inscreve no livro
        this.setupWebSocket(book.id);
      },
      error: async () => {
        try {
          const offlineBook = await this.downloadService.getBook(id);
          if (offlineBook) {
            if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
            this.coverUrl = URL.createObjectURL(offlineBook.cover);

            this.book = {
              id: offlineBook.id,
              title: offlineBook.title,
              cover: this.coverUrl,
              description: offlineBook.description,
              publication: offlineBook.publication,
              scrapingStatus: ScrapingStatus.READY,
              tags: offlineBook.tags,
              sensitiveContent: offlineBook.sensitiveContent,
              totalChapters: offlineBook.totalChapters,
              authors: offlineBook.authors || []
            };
            this.isLoading.set(false);
            this.setMetaData();
          } else {
            this.router.navigate(['../'], { relativeTo: this.activatedRoute });
          }
        } catch (e) {
          this.router.navigate(['../'], { relativeTo: this.activatedRoute });
        }
      }
    });
  }

  ngOnDestroy() {
    // Limpa a inscrição do WebSocket
    this.wsSubscription?.unsubscribe();
    if (this.book) {
      this.wsService.unsubscribeFromBook(this.book.id);
    }
    if (this.coverUrl) {
      URL.revokeObjectURL(this.coverUrl);
    }
  }

  private setupWebSocket(bookId: string) {
    // Conecta se ainda não estiver conectado
    if (!this.wsService.isConnected()) {
      this.wsService.connect();
    }

    // Observa eventos do livro
    this.wsSubscription = this.wsService.watchBook(bookId).subscribe(event => {
      console.log('📡 Evento recebido:', event.type, event.data);

      switch (event.type) {
        case 'book.updated':
          // Atualiza informações do livro
          this.book.title = event.data.title;
          console.log('✅ Livro atualizado em tempo real');
          break;

        case 'chapters.updated':
          // Atualiza capítulos
          console.log('✅ Capítulos atualizados em tempo real');
          // Recarrega o livro para obter os capítulos atualizados
          this.refreshBook();
          break;

        case 'chapter.scraping.started':
          console.log('🔄 Scraping iniciado para capítulo:', event.data.chapterId);
          break;

        case 'chapter.scraping.completed':
          console.log('✅ Scraping completo! Páginas:', event.data.pagesCount);
          this.refreshBook();
          break;

        case 'chapter.scraping.failed':
          console.error('❌ Scraping falhou:', event.data.error);
          break;

        case 'cover.selected':
          // Atualiza capa
          this.refreshBook();
          break;
      }
    });
  }

  private refreshBook() {
    if (this.book) {
      this.bookService.getBook(this.book.id).subscribe({
        next: (book) => {
          if (book) {
            this.book = book;
            console.log('♻️ Livro recarregado');
          }
        }
      });
    }
  }

  setMetaData() {
    this.metaService.setMetaData({
      title: this.book.title,
      description: this.book.description,
      image: this.book.cover,
      url: `https://example.com/books/${this.book.id}`,
    });
  }

  getScrapingStatusClass(status: ScrapingStatus): string {
    switch (status) {
      case ScrapingStatus.READY:
        return 'Pronto';
      case ScrapingStatus.PROCESSING:
        return 'Processando';
      case ScrapingStatus.ERROR:
        return 'error';
      default:
        return '';
    }
  }

  getAuthorNames(): string {
    return this.book.authors?.map(author => author.name).join(', ') || '';
  }
  filterByTag(tagId: string) {
    this.router.navigate(['/books'], { queryParams: { tags: tagId } });
  }
  fixBook() {
    if (this.book) {
      this.modalService.show(
        'Consertar Livro',
        `Você tem certeza que deseja consertar o livro "${this.book.title}"?`,
        [
          {
            label: 'Cancelar',
            type: 'primary',
          },
          {
            label: 'Consertar',
            type: 'danger',
            callback: () => {
              this.confirmFixBook();
            }
          }
        ],
        'warning'
      )
    }
  }

  confirmFixBook() {
    if (this.book) {
      this.bookService.fixBook(this.book.id).subscribe(() => {
        this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      });
    }
  }

  resetBook() {
    if (this.book) {
      this.modalService.show(
        'Redefinir Livro',
        `Você tem certeza que deseja redefinir o livro "${this.book.title}"? Esta ação não pode ser desfeita.`,
        [
          {
            label: 'Cancelar',
            type: 'primary',
          },
          {
            label: 'Redefinir',
            type: 'danger',
            callback: () => {
              this.confirmResetBook();
            }
          }
        ],
        'warning'
      );
    }
  }

  confirmResetBook() {
    if (this.book) {
      this.bookService.resetBook(this.book.id).subscribe(() => {
        this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      });
    }
  }

  // ==================== CONTINUE LENDO ====================

  private async loadLastReadingProgress() {
    if (!this.book) return;

    const progress = await this.readingProgressService.getLastProgressForBook(this.book.id);
    if (progress) {
      this.lastReadChapterId = progress.chapterId;
      this.lastReadPage = progress.pageIndex;
    }
  }

  private loadFirstChapter() {
    if (!this.book) return;

    this.bookService.getChapters(this.book.id).subscribe({
      next: (chapters: Chapterlist[]) => {
        if (chapters && chapters.length > 0) {
          // Ordena por índice e pega o primeiro
          const sortedChapters = [...chapters].sort((a, b) => a.index - b.index);
          this.firstChapterId = sortedChapters[0].id;
        }
      },
      error: (err) => {
        console.error('Erro ao carregar capítulos:', err);
      }
    });
  }

  continueReading() {
    if (this.lastReadChapterId) {
      this.router.navigate([this.lastReadChapterId], {
        relativeTo: this.activatedRoute,
        queryParams: { page: this.lastReadPage }
      });
    } else if (this.firstChapterId) {
      // Se não há progresso, vai para o primeiro capítulo
      this.router.navigate([this.firstChapterId], { relativeTo: this.activatedRoute });
    } else {
      // Se ainda não carregou os capítulos, mostra mensagem
      this.modalService.show(
        'Aguarde',
        'Os capítulos ainda estão sendo carregados. Tente novamente em alguns segundos.',
        [{ label: 'Ok', type: 'primary' }],
        'info'
      );
    }
  }

  // ==================== DROPDOWN DE OPÇÕES ====================

  toggleOptionsDropdown() {
    this.showOptionsDropdown.update(v => !v);
  }

  closeOptionsDropdown() {
    this.showOptionsDropdown.set(false);
  }

  async downloadBook() {
    this.closeOptionsDropdown();

    if (!this.book) return;

    this.modalService.show(
      'Baixar Livro',
      `Deseja baixar todos os capítulos do livro "${this.book.title}"? Isso pode demorar dependendo do número de capítulos.`,
      [
        {
          label: 'Cancelar',
          type: 'primary',
        },
        {
          label: 'Baixar',
          type: 'danger',
          callback: () => this.confirmDownloadBook()
        }
      ],
      'info'
    );
  }

  private confirmDownloadBook() {
    // Por enquanto apenas mostra uma mensagem
    // TODO: Implementar download de todos os capítulos
    this.modalService.show(
      'Download iniciado',
      'O download dos capítulos será iniciado em breve. Você pode acompanhar o progresso na lista de capítulos.',
      [
        {
          label: 'Ok',
          type: 'primary',
        }
      ],
      'info'
    );
  }

  shareBook() {
    this.closeOptionsDropdown();

    if (navigator.share) {
      navigator.share({
        title: this.book.title,
        text: this.book.description,
        url: window.location.href
      }).catch(console.error);
    } else {
      // Fallback: copia o link
      navigator.clipboard.writeText(window.location.href).then(() => {
        this.modalService.show(
          'Link copiado!',
          'O link do livro foi copiado para a área de transferência.',
          [{ label: 'Ok', type: 'primary' }],
          'success'
        );
      });
    }
  }
}
