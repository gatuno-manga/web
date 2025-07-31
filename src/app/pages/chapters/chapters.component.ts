import { Component, HostListener } from '@angular/core';
import { Chapter } from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconsComponent } from '../../components/icons/icons.component';
import { HeaderComponent } from '../../components/header/header.component';
import { DecimalPipe, NgClass, NgIf } from '@angular/common';
import { ChapterService } from '../../service/chapter.service';
import { UserTokenService } from '../../service/user-token.service';
import { ModalNotificationService } from '../../service/modal-notification.service';

@Component({
  selector: 'app-chapters',
  imports: [IconsComponent, HeaderComponent, NgIf, RouterModule, NgClass, DecimalPipe],
  templateUrl: './chapters.component.html',
  styleUrl: './chapters.component.scss'
})
export class ChaptersComponent {
  chapter!: Chapter;
  showBtnTop = false;
  private lastScrollTop = 0;
  private scrollThreshold = 1500;
  admin = false;

  constructor(
    private chapterService: ChapterService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private userTokenService: UserTokenService,
    private modalService: ModalNotificationService
  ) {
    this.admin = this.userTokenService.isAdmin();
  }

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

  resetChapter() {
    if (this.chapter) {
      this.modalService.show(
        'Redefinir Capítulo',
        `Tem certeza que deseja redefinir o capítulo\n"${this.chapter.bookTitle} (${this.chapter.index})"?\nEsta ação não pode ser desfeita.`,
        [
          {
            label: 'Cancelar',
            type: 'primary',
          },
          {
            label: 'Redefinir',
            type: 'danger',
            callback: () => {
              this.confirmResetChapter();
            }
          }
        ],
        'warning'
      );
    }
  }
  confirmResetChapter() {
    if (this.chapter) {
      this.chapterService.resetChapter(this.chapter.id).subscribe(() => {
        this.router.navigate(['../'], { relativeTo: this.activatedRoute });
      });
    }
  }
}
