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
import { ChapterService } from '../../service/chapter.service';
import { Subscription, firstValueFrom } from 'rxjs';

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
  private sortedChapters: Chapterlist[] = [];

  // Estado para dropdown de opções
  showOptionsDropdown = signal(false);

  // Estado para verificar se o livro está baixado
  isBookDownloaded = signal(false);

  // Estado para erro de imagem de capa
  coverImageError = false;

  constructor(
    private bookService: BookService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private metaService: MetaDataService,
    private modalService: ModalNotificationService,
    private userTokenService: UserTokenService,
    private wsService: BookWebsocketService,
    private downloadService: DownloadService,
    private readingProgressService: UnifiedReadingProgressService,
    private chapterService: ChapterService
  ) {
    this.admin = this.userTokenService.isAdmin;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closeOptionsDropdown();
  }

  onCoverImageError() {
    this.coverImageError = true;
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

        // Verifica se o livro está baixado
        this.checkBookDownloaded();

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
          // Ordena por índice e guarda a lista
          this.sortedChapters = [...chapters].sort((a, b) => a.index - b.index);
          this.firstChapterId = this.sortedChapters[0].id;
        }
      },
      error: (err) => {
        console.error('Erro ao carregar capítulos:', err);
      }
    });
  }

  async continueReading() {
    if (this.lastReadChapterId) {
      // Verificar se precisa ir para o próximo capítulo
      const targetChapter = await this.getTargetChapter();

      if (targetChapter.goToNext && targetChapter.nextChapterId) {
        // Usuário terminou o capítulo, vai para o próximo
        this.router.navigate([targetChapter.nextChapterId], {
          relativeTo: this.activatedRoute
        });
      } else if (targetChapter.isLastPage) {
        // Usuário está na última página e não tem próximo capítulo, volta para o início
        this.router.navigate([this.lastReadChapterId], {
          relativeTo: this.activatedRoute,
          queryParams: { page: 0 }
        });
      } else {
        // Continua no capítulo atual
        this.router.navigate([this.lastReadChapterId], {
          relativeTo: this.activatedRoute,
          queryParams: { page: this.lastReadPage }
        });
      }
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

  private async getTargetChapter(): Promise<{ goToNext: boolean; nextChapterId: string | null; isLastPage: boolean }> {
    if (!this.lastReadChapterId) {
      return { goToNext: false, nextChapterId: null, isLastPage: false };
    }

    try {
      // Busca o capítulo atual para saber o total de páginas
      const chapter = await firstValueFrom(this.chapterService.getChapter(this.lastReadChapterId));

      if (!chapter) {
        return { goToNext: false, nextChapterId: null, isLastPage: false };
      }

      const totalPages = chapter.pages?.length || 0;
      const isLastPage = this.lastReadPage >= totalPages - 1;

      if (isLastPage && chapter.next) {
        // Usuário está na última página e existe próximo capítulo
        return { goToNext: true, nextChapterId: chapter.next, isLastPage: true };
      }

      // Alternativa: usar a lista de capítulos ordenada
      if (isLastPage && this.sortedChapters.length > 0) {
        const currentIndex = this.sortedChapters.findIndex(c => c.id === this.lastReadChapterId);
        if (currentIndex >= 0 && currentIndex < this.sortedChapters.length - 1) {
          return { goToNext: true, nextChapterId: this.sortedChapters[currentIndex + 1].id, isLastPage: true };
        }
      }

      return { goToNext: false, nextChapterId: null, isLastPage };
    } catch (error) {
      console.error('Erro ao verificar capítulo:', error);
      return { goToNext: false, nextChapterId: null, isLastPage: false };
    }
  }

  // ==================== DROPDOWN DE OPÇÕES ====================

  toggleOptionsDropdown() {
    this.showOptionsDropdown.update(v => !v);
  }

  closeOptionsDropdown() {
    this.showOptionsDropdown.set(false);
  }

  async checkBookDownloaded() {
    if (!this.book) return;
    const isDownloaded = await this.downloadService.isBookDownloaded(this.book.id);
    this.isBookDownloaded.set(isDownloaded);
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

  async deleteDownloadedBook() {
    this.closeOptionsDropdown();

    if (!this.book) return;

    this.modalService.show(
      'Excluir Download',
      `Deseja excluir o livro "${this.book.title}" dos downloads? Os capítulos baixados serão removidos do seu dispositivo.`,
      [
        {
          label: 'Cancelar',
          type: 'primary',
        },
        {
          label: 'Excluir',
          type: 'danger',
          callback: async () => {
            await this.downloadService.deleteBook(this.book.id);
            this.isBookDownloaded.set(false);
            this.modalService.show(
              'Download excluído',
              'O livro foi removido dos downloads.',
              [{ label: 'Ok', type: 'primary' }],
              'success'
            );
          }
        }
      ],
      'warning'
    );
  }

  private confirmDownloadBook = async () => {
    if (!this.book) return;

    try {
      // Buscar lista de capítulos
      const chapters = await firstValueFrom(this.bookService.getChapters(this.book.id));

      if (chapters.length === 0) {
        this.modalService.show(
          'Sem capítulos',
          'Este livro não possui capítulos para baixar.',
          [{ label: 'Ok', type: 'primary' }],
          'info'
        );
        return;
      }

      this.modalService.show(
        'Download iniciado',
        `Baixando ${chapters.length} capítulos em segundo plano. Você pode continuar navegando.`,
        [{ label: 'Ok', type: 'primary' }],
        'info'
      );

      // Função auxiliar para delay
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Baixar capítulos sequencialmente em segundo plano com intervalo de 1s
      this.downloadChaptersInBackground(chapters, delay);
    } catch (error) {
      console.error('Erro ao buscar capítulos:', error);
      this.modalService.show(
        'Erro',
        'Não foi possível buscar os capítulos do livro.',
        [{ label: 'Ok', type: 'primary' }],
        'error'
      );
    }
  }

  private async downloadChaptersInBackground(chapters: Chapterlist[], delay: (ms: number) => Promise<unknown>) {
    let downloadedCount = 0;
    let skippedCount = 0;

    for (const chapterInfo of chapters) {
      try {
        // Verificar se já foi baixado
        const isDownloaded = await this.downloadService.isChapterDownloaded(chapterInfo.id);
        if (isDownloaded) {
          skippedCount++;
          continue;
        }

        // Buscar detalhes do capítulo com as páginas
        const fullChapter = await firstValueFrom(this.chapterService.getChapter(chapterInfo.id));
        if (!fullChapter) continue;

        // Baixar capítulo
        await this.downloadService.downloadChapter(this.book, fullChapter);
        downloadedCount++;

        // Aguardar 1 segundo antes do próximo para não sobrecarregar o servidor
        await delay(1000);
      } catch (error) {
        console.error(`Erro ao baixar capítulo ${chapterInfo.id}:`, error);
        // Continua para o próximo capítulo mesmo se houver erro
      }
    }

    // Notificar conclusão e atualizar status
    this.isBookDownloaded.set(true);
    this.modalService.show(
      'Download concluído',
      `${downloadedCount} capítulos baixados${skippedCount > 0 ? `, ${skippedCount} já estavam salvos` : ''}.`,
      [{ label: 'Ok', type: 'primary' }],
      'success'
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
