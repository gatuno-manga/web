import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Book, ScrapingStatus } from '../../models/booke.models';
import { BookService } from '../../service/book.service';

@Component({
  selector: 'app-book',
  imports: [RouterModule],
  templateUrl: './book.component.html',
  styleUrl: './book.component.scss'
})
export class BookComponent {
  book: Book = {
    id: '',
    title: '',
    chapters: [],
    scrapingStatus: ScrapingStatus.PROCESSING,
  };
  constructor(
    private bookService: BookService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
    // TODO: Quando o id não for encontrado figa bugado
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['../'], { relativeTo: this.activatedRoute });
    } else {
      this.bookService.getBook(id).subscribe((book: Book) => {
        this.book = book;
      });
    }
  }
}
