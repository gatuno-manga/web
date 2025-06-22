import { Component } from '@angular/core';
import { Chapter } from '../../models/booke.models';
import { BookService } from '../../service/book.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-chapters',
  imports: [],
  templateUrl: './chapters.component.html',
  styleUrl: './chapters.component.scss'
})
export class ChaptersComponent {
  chapter!: Chapter

  constructor(
    private bookService: BookService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    const chapter = this.activatedRoute.snapshot.paramMap.get('chapter');
    if (!id || !chapter) {
      this.router.navigate(['../'], { relativeTo: this.activatedRoute });
    }
    this.bookService.getChapter(id!, chapter!).subscribe((chapter: Chapter) => {
      this.chapter = chapter;
    });
  }
}
