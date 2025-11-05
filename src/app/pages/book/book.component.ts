import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BookBasic, ScrapingStatus } from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { IconsComponent } from '../../components/icons/icons.component';
import { MetaDataService } from '../../service/meta-data.service';
import { UserTokenService } from '../../service/user-token.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { InfoBookComponent } from '../../components/info-book/info-book.component';
import { AsideComponent } from '../../components/aside/aside.component';
import { ButtonComponent } from '../../components/inputs/button/button.component';
import { BookWebsocketService } from '../../service/book-websocket.service';
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

  constructor(
    private bookService: BookService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private metaService: MetaDataService,
    private modalService: ModalNotificationService,
    private userTokenService: UserTokenService,
    private wsService: BookWebsocketService
  ) {
    this.admin = this.userTokenService.isAdmin();
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

        // Conecta ao WebSocket e inscreve no livro
        this.setupWebSocket(book.id);
      },
      error: () => {
        this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      }
    });
  }

  ngOnDestroy() {
    // Limpa a inscrição do WebSocket
    this.wsSubscription?.unsubscribe();
    if (this.book) {
      this.wsService.unsubscribeFromBook(this.book.id);
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
    return this.book.authors.map(author => author.name).join(', ');
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
}
