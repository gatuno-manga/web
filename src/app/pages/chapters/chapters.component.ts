import { Component, HostListener } from '@angular/core';
import { Chapter } from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconsComponent } from '../../components/icons/icons.component';
import { HeaderComponent } from '../../components/header/header.component';
import { NgClass, NgIf } from '@angular/common';
import { ChapterService } from '../../service/chapter.service';

@Component({
  selector: 'app-chapters',
  imports: [IconsComponent, HeaderComponent, NgIf, RouterModule, NgClass],
  templateUrl: './chapters.component.html',
  styleUrl: './chapters.component.scss'
})
export class ChaptersComponent {
  chapter!: Chapter;
  showBtnTop = false;
  private lastScrollTop = 0;
  private scrollThreshold = 1500;

  constructor(
    private chapterService: ChapterService,
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
      this.chapterService.getChapter(chapter).subscribe((chapter: Chapter) => {
        this.chapter = chapter;
      });
    });
  }

  backPage() {
    this.router.navigate(['../'], { relativeTo: this.activatedRoute }).then(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  nextPage() {
    if (this.chapter.next) {
      this.router.navigate(['../', this.chapter.next], { relativeTo: this.activatedRoute }).then(() => {
        window.scrollTo({ top: 0 });
      });
    }
  }
  previousPage() {
    if (this.chapter.previous) {
      this.router.navigate(['../', this.chapter.previous], { relativeTo: this.activatedRoute }).then(() => {
        window.scrollTo({ top: 0 });
      });
    }
  }

  scrolledUpAmount = 0;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const st = window.pageYOffset || document.documentElement.scrollTop;
    if (st < this.lastScrollTop) {
      this.scrolledUpAmount += this.lastScrollTop - st;
    } else {
      this.scrolledUpAmount = 0;
    }
    this.showBtnTop = this.scrolledUpAmount > this.scrollThreshold;
    this.lastScrollTop = st <= 0 ? 0 : st;
  }

  clearScrolledUpAmount() {
    this.scrolledUpAmount = 0;
    this.showBtnTop = false;
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
