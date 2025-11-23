import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Chapter } from '../../models/book.models';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IconsComponent } from '../../components/icons/icons.component';
import { HeaderComponent } from '../../components/header/header.component';
import { DecimalPipe, NgClass } from '@angular/common';
import { ChapterService } from '../../service/chapter.service';
import { UserTokenService } from '../../service/user-token.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { NotificationService } from '../../service/notification.service';
import { ButtonComponent } from '../../components/inputs/button/button.component';
import { AsideComponent } from '../../components/aside/aside.component';
import { MetaDataService } from '../../service/meta-data.service';
import { SettingsService } from '../../service/settings.service';
import { ReaderSettings } from '../../models/settings.models';
import { Subscription } from 'rxjs';
import { NotificationSeverity } from 'app/service/notification';
import { ReaderSettingsNotificationComponent } from '@components/notification/custom-components';
import { BookWebsocketService } from '../../service/book-websocket.service';

@Component({
  selector: 'app-chapters',
  imports: [IconsComponent, HeaderComponent, RouterModule, NgClass, DecimalPipe, ButtonComponent, AsideComponent],
  templateUrl: './chapters.component.html',
  styleUrl: './chapters.component.scss'
})
export class ChaptersComponent implements OnInit, OnDestroy {
  chapter?: Chapter;
  showBtnTop = false;
  readingProgress = 0;
  private lastScrollTop = 0;
  private scrollThreshold = 1500;
  private readonly BOTTOM_THRESHOLD = 100;
  admin = false;
  settings: ReaderSettings;
  filterStyle: string = '';
  private settingsSubscription?: Subscription;
  private wsSubscription?: Subscription;

  @ViewChild('progressBarRef') progressBarRef!: ElementRef<HTMLDivElement>;
  isDragging = false;
  startDrag(event: MouseEvent | TouchEvent) {
    this.isDragging = true;
    this.updateScrollFromProgressBar(event);
  }

  @HostListener('document:mousemove', ['$event'])
  @HostListener('document:touchmove', ['$event'])
  onDrag(event: MouseEvent | TouchEvent) {
    if (this.isDragging) {
      if (event.cancelable) event.preventDefault();
      this.updateScrollFromProgressBar(event);
    }
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  stopDrag() {
    this.isDragging = false;
  }

  private updateScrollFromProgressBar(event: MouseEvent | TouchEvent) {
    if (!this.progressBarRef) return;

    const rect = this.progressBarRef.nativeElement.getBoundingClientRect();
    let clientX: number;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
    } else {
      return;
    }

    let percentage = (clientX - rect.left) / rect.width;
    percentage = Math.max(0, Math.min(1, percentage));

    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    const scrollableHeight = documentHeight - windowHeight;

    window.scrollTo({
      top: scrollableHeight * percentage,
      behavior: 'auto'
    });
  }

  constructor(
    private chapterService: ChapterService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private userTokenService: UserTokenService,
    private metaService: MetaDataService,
    private modalService: ModalNotificationService,
    private notificationService: NotificationService,
    private settingsService: SettingsService,
    private wsService: BookWebsocketService
  ) {
    this.admin = this.userTokenService.isAdmin();
    this.settings = this.settingsService.getSettings();
  }

  ngOnInit() {
    this.settingsSubscription = this.settingsService.settings$.subscribe(
      settings => {
        this.settings = settings;
        this.filterStyle = this.buildFilter(settings);
      }
    );

    this.activatedRoute.paramMap.subscribe(params => {
      const id = params.get('id');
      const chapterId = params.get('chapter');
      if (!id || !chapterId) {
        this.router.navigate(['../'], { relativeTo: this.activatedRoute });
        return;
      }
      this.chapterService.getChapter(chapterId).subscribe((chapter: Chapter) => {
        this.chapter = chapter;
        this.setMetaData();

        this.setupWebSocket(chapterId, id);
      });
    });
  }

  ngOnDestroy() {
    this.settingsSubscription?.unsubscribe();
    this.wsSubscription?.unsubscribe();
    if (this.chapter) {
      this.wsService.unsubscribeFromChapter(this.chapter.id);
    }
  }

  private setupWebSocket(chapterId: string, bookId: string) {
    if (!this.wsService.isConnected()) {
      this.wsService.connect();
    }

    this.wsSubscription = this.wsService.watchChapter(chapterId, bookId).subscribe(event => {
      console.log('📡 Evento recebido no capítulo:', event.type, event.data);

      switch (event.type) {
        case 'chapter.updated':
          console.log('📖 Capítulo atualizado em tempo real');
          this.refreshChapter();
          break;

        case 'chapter.scraping.started':
          console.log('🔄 Scraping iniciado para este capítulo');
          break;

        case 'chapter.scraping.completed':
          console.log('✅ Scraping completo! Novas páginas disponíveis:', event.data.pagesCount);
          this.refreshChapter();
          break;

        case 'chapter.scraping.failed':
          console.error('❌ Scraping falhou:', event.data.error);
          break;
      }
    });
  }

  private refreshChapter() {
    if (this.chapter) {
      this.chapterService.getChapter(this.chapter.id).subscribe({
        next: (chapter) => {
          this.chapter = chapter;
          console.log('♻️ Capítulo recarregado');
        }
      });
    }
  }

  private buildFilter(settings: ReaderSettings): string {
    const parts: string[] = [];
    if (settings.brightness != null) {
      parts.push(`brightness(${settings.brightness}%)`);
    }
    if (settings.contrast != null) {
      parts.push(`contrast(${settings.contrast}%)`);
    }
    if (settings.grayScale) {
      parts.push(`grayscale(100%)`);
    }
    if (settings.invert != null && settings.invert > 0) {
      parts.push(`invert(${settings.invert}%)`);
    }
    const filter = parts.length > 0 ? parts.join(' ') : 'none';
    try {
      console.debug('[Chapters] buildFilter ->', filter, settings);
    } catch (e) {}
    return filter;
  }

  private formatNumber(value: number): string {
    return Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  setMetaData() {
    const defaultImage = this.chapter?.pages?.[0]?.path || '';

    this.metaService.setMetaData({
      title: this.chapter ? `Capitulo ${this.formatNumber(this.chapter.index)} | ${this.chapter.bookTitle}` : 'Capítulo',
      description: this.chapter ? `Ler online o capítulo ${this.formatNumber(this.chapter.index)} do livro ${this.chapter.bookTitle}.` : 'Capítulo',
      image: defaultImage,
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

    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollableHeight = documentHeight - windowHeight;

    if (scrollableHeight > 0) {
      this.readingProgress = Math.min((scrollTop / scrollableHeight) * 100, 100);
    } else {
      this.readingProgress = 0;
    }
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

  openSettings() {
    this.notificationService.notify({
      message: '',
      level: 'custom',
      severity: NotificationSeverity.CRITICAL,
      component: ReaderSettingsNotificationComponent,
      componentData: {
        title: 'Configurações do Leitor',
        subtitle: 'Personalize sua experiência de leitura',
      },
      useBackdrop: true,
      backdropOpacity: 0.8
    });
  }

  goToPage(index: number) {
    if (this.chapter && this.chapter.pages && index >= 0 && index < this.chapter.pages.length) {
      const pageElement = document.getElementById(`page-${index}`);
      if (pageElement) {
        const yOffset = -15;
        const y = pageElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  }
}
