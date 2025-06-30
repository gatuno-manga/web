import { Component } from '@angular/core';
import { Chapter } from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconsComponent } from '../../components/icons/icons.component';
import { HeaderComponent } from '../../components/header/header.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-chapters',
  imports: [IconsComponent, HeaderComponent, NgIf, RouterModule],
  templateUrl: './chapters.component.html',
  styleUrl: './chapters.component.scss'
})
export class ChaptersComponent {
  chapter!: Chapter;

  constructor(
    private bookService: BookService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe(params => {
      const id = params.get('id');
      const chapter = params.get('chapter');
      if (!id || !chapter) {
        this.router.navigate(['../'], { relativeTo: this.activatedRoute });
        return;
      }
      this.bookService.getChapter(id, chapter).subscribe((chapter: Chapter) => {
        this.chapter = chapter;
      });
    });
  }

  backPage() {
    this.router.navigate(['../'], { relativeTo: this.activatedRoute });
  }

  nextPage() {
    if (this.chapter.next) {
      this.router.navigate(['../', this.chapter.next], { relativeTo: this.activatedRoute });
    }
  }
  previousPage() {
    if (this.chapter.previous) {
      this.router.navigate(['../', this.chapter.previous], { relativeTo: this.activatedRoute });
    }
  }
}
