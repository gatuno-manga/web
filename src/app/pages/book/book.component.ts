import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Book, BookBasic, ScrapingStatus } from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { DecimalPipe, NgClass, NgIf } from '@angular/common';
import { IconsComponent } from '../../components/icons/icons.component';
import { MetaDataService } from '../../service/meta-data.service';
import { UserTokenService } from '../../service/user-token.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { InfoBookComponent } from '../../components/info-book/info-book.component';

@Component({
  selector: 'app-book',
  imports: [RouterModule, NgIf, InfoBookComponent],
  templateUrl: './book.component.html',
  styleUrl: './book.component.scss',
})
export class BookComponent {
  ScrapingStatus = ScrapingStatus;
  book!: BookBasic;
  admin = false;
  isLoading = signal(true);

  constructor(
    private bookService: BookService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private metaService: MetaDataService,
    private modalService: ModalNotificationService,
    private userTokenService: UserTokenService
  ) {
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
      },
      error: () => {
        this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      }
    });
    this.admin = this.userTokenService.isAdmin();
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

  // getMaxChapterIndex(): number {
  //   return this.book.chapters.reduce((max, chapter) => Math.max(max, chapter.index), 0);
  // }

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
