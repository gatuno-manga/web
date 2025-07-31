import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Book, ScrapingStatus } from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { DecimalPipe, NgClass } from '@angular/common';
import { IconsComponent } from '../../components/icons/icons.component';

@Component({
  selector: 'app-book',
  imports: [RouterModule, IconsComponent, NgClass, DecimalPipe],
  templateUrl: './book.component.html',
  styleUrl: './book.component.scss'
})
export class BookComponent {
  ScrapingStatus = ScrapingStatus;
  book!: Book;
  constructor(
    private bookService: BookService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      return;
    }
    this.bookService.getBook(id).subscribe({
      next: (book) => {
        this.book = book;
        console.log('Livro carregado:', this.book);
      },
      error: (err) => {
        console.error('Erro ao buscar livro:', err);
        this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      }
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

  getMaxChapterIndex(): number {
    return this.book.chapters.reduce((max, chapter) => Math.max(max, chapter.index), 0);
  }
}
