import { Component, HostListener } from '@angular/core';
import { Chapter } from '../../models/book.models';
import { BookService } from '../../service/book.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconsComponent } from '../../components/icons/icons.component';
import { HeaderComponent } from '../../components/header/header.component';
import { DecimalPipe, NgClass } from '@angular/common';
import { ChapterService } from '../../service/chapter.service';
import { UserTokenService } from '../../service/user-token.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { ButtonComponent } from '../../components/inputs/button/button.component';
import { AsideComponent } from '../../components/aside/aside.component';
import { MetaDataService } from '../../service/meta-data.service';

@Component({
  selector: 'app-chapters',
  imports: [IconsComponent, HeaderComponent, RouterModule, NgClass, DecimalPipe, ButtonComponent, AsideComponent],
  templateUrl: './chapters.component.html',
  styleUrl: './chapters.component.scss'
})
export class ChaptersComponent {
  chapter?: Chapter;
  showBtnTop = false;
  private lastScrollTop = 0;
  private scrollThreshold = 1500;
  private readonly BOTTOM_THRESHOLD = 100;
  admin = false;

  constructor(
    private chapterService: ChapterService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private userTokenService: UserTokenService,
    private metaService: MetaDataService,
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
        this.setMetaData();
      });
    });
  }

  private formatNumber(value: number): string {
    return Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  setMetaData() {
    this.metaService.setMetaData({
      title: this.chapter ? `Capitulo ${this.formatNumber(this.chapter.index)} | ${this.chapter.bookTitle}` : 'Capítulo',
      description: this.chapter ? `Ler online o capítulo ${this.formatNumber(this.chapter.index)} do livro ${this.chapter.bookTitle}.` : 'Capítulo',
      image: this.chapter ? this.chapter.pages[0].path : '',
    })
  }

  backPage() {
    this.router.navigate(['../'], { relativeTo: this.activatedRoute }).then(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  nextPage() {
    if (this.chapter?.next) {
      this.router.navigate(['../', this.chapter.next], { relativeTo: this.activatedRoute }).then(() => {
        window.scrollTo({ top: 0 });
      });
    }
  }
  previousPage() {
    if (this.chapter?.previous) {
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

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {

    // Ctrl + Alt + Seta para cima/baixo: pula de página em página
    if (event.ctrlKey && event.altKey) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.scrollToTop();
        return;
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        return;
      }
    }

    // Ctrl + Seta para cima/baixo: pula de página em página (imagens do capítulo)
    if (event.ctrlKey) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.scrollToPreviousImage();
        return;
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.scrollToNextImage();
        return;
      }
    }

    const isAtBottom = (window.innerHeight + window.pageYOffset) >= document.body.offsetHeight - this.BOTTOM_THRESHOLD;

    if (isAtBottom && event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextPage();
    } else if (window.pageYOffset <= this.BOTTOM_THRESHOLD && event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previousPage();
    }
  }

  scrollToNextImage() {
    const delta = Math.floor(window.innerHeight * 0.7);
    const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 0);
    const target = Math.min(window.pageYOffset + delta, maxScroll);
    window.scrollTo({ top: target, behavior: 'smooth' });
  }

  scrollToPreviousImage() {
    const delta = Math.floor(window.innerHeight * 0.7);
    const target = Math.max(window.pageYOffset - delta, 0);
    window.scrollTo({ top: target, behavior: 'smooth' });
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
        `Tem certeza que deseja redefinir o capítulo\n"${this.chapter.bookTitle} (${this.formatNumber(this.chapter.index)})"?\nEsta ação não pode ser desfeita.`,
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

  openOriginalLink() {
    if (this.chapter && this.chapter.originalUrl) {
      window.open(this.chapter.originalUrl, '_blank');
    }
  }
}
