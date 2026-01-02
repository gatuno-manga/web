import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed,
  effect,
  DestroyRef,
  AfterViewInit,
  ViewChildren,
  QueryList,
  PLATFORM_ID,
  afterNextRender,
  Injector
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import { NotificationSeverity } from 'app/service/notification';
import { ReaderSettingsNotificationComponent } from '@components/notification/custom-components';
import { PromptModalComponent } from '@components/notification/custom-components/prompt-modal/prompt-modal.component';
import { BookWebsocketService } from '../../service/book-websocket.service';
import { DownloadService } from '../../service/download.service';
import { UnifiedReadingProgressService } from '../../service/unified-reading-progress.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { ContextMenuService } from '../../service/context-menu.service';
import { SavedPagesService } from '../../service/saved-pages.service';
import { Page } from '../../models/book.models';

@Component({
  selector: 'app-chapters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconsComponent,
    HeaderComponent,
    RouterModule,
    NgClass,
    DecimalPipe,
    ButtonComponent,
    AsideComponent
  ],
  templateUrl: './chapters.component.html',
  styleUrl: './chapters.component.scss'
})
export class ChaptersComponent implements OnInit, OnDestroy, AfterViewInit {
  private activatedRoute = inject(ActivatedRoute);
  private chapterService = inject(ChapterService);
  private userTokenService = inject(UserTokenService);
  private modalNotificationService = inject(ModalNotificationService);
  private notificationService = inject(NotificationService);
  private metaDataService = inject(MetaDataService);
  private settingsService = inject(SettingsService);
  private bookWebsocketService = inject(BookWebsocketService);
  private downloadService = inject(DownloadService);
  private readingProgressService = inject(UnifiedReadingProgressService);
  private contextMenuService = inject(ContextMenuService);
  private savedPagesService = inject(SavedPagesService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private injector = inject(Injector);

  progressBarRef = viewChild<ElementRef>('progressBarRef');
  @ViewChildren('pageRef') pageRefs!: QueryList<ElementRef>;

  chapter = signal<Chapter | null>(null);
  readingProgress = signal<number>(0);
  showBtnTop = signal<boolean>(false);

  private objectUrls: string[] = [];
  private intersectionObserver: IntersectionObserver | null = null;
  private destroyRef = inject(DestroyRef);
  private maxReadPageIndex = 0;
  private isNavigating = false;
  private lastScrollPosition = 0;

  settings = toSignal(this.settingsService.settings$, {
    initialValue: this.settingsService.getSettings()
  });

  filterStyle = computed(() => {
    const s = this.settings();
    const parts: string[] = [];
    if (s.brightness != null) parts.push(`brightness(${s.brightness}%)`);
    if (s.contrast != null) parts.push(`contrast(${s.contrast}%)`);
    if (s.grayScale) parts.push(`grayscale(100%)`);
    if (s.invert != null && s.invert > 0) parts.push(`invert(${s.invert}%)`);
    return parts.length > 0 ? parts.join(' ') : 'none';
  });

  admin = this.userTokenService.isAdminSignal;

  constructor() {
    this.activatedRoute.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const chapterId = params.get('chapter');
        const bookId = params.get('id');

        if (chapterId) {
          this.loadChapter(chapterId);
          if (bookId) {
            this.setupWebSocket(chapterId, bookId);
          }
        } else {
          this.backPage();
        }
      });

    afterNextRender(() => {
      this.setupScrollListener();
    }, { injector: this.injector });
  }

  ngOnInit(): void {}

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.pageRefs.changes
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((refs: QueryList<ElementRef>) => {
        if (refs.length > 0) {
          setTimeout(() => {
            this.setupIntersectionObserver();
            this.restoreReadingProgress();
          }, 100);
        }
      });
  }

  private setupScrollListener() {
    this.lastScrollPosition = window.scrollY || document.documentElement.scrollTop || 0;

    fromEvent(window, 'scroll')
      .pipe(
        throttleTime(50, undefined, { leading: true, trailing: true }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

        if (windowHeight > 0) {
          const progress = (currentScroll / windowHeight) * 100;
          this.readingProgress.set(progress);
        }

        const isScrolledDown = currentScroll > 400;
        const isScrollingUp = currentScroll < this.lastScrollPosition;

        if (isScrolledDown && isScrollingUp) {
          this.showBtnTop.set(true);
        } else {
          this.showBtnTop.set(false);
        }

        this.lastScrollPosition = currentScroll;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  private setupWebSocket(chapterId: string, bookId: string) {
    if (!this.bookWebsocketService.isConnected()) {
      this.bookWebsocketService.connect();
    }

    this.bookWebsocketService.watchChapter(chapterId, bookId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: any) => {
        if (event.type === 'chapter.updated' || event.type === 'chapter.scraping.completed') {
          this.refreshChapter();
        }
      });
  }

  async loadChapter(id: string) {
    this.maxReadPageIndex = 0;
    try {
      const isDownloaded = await this.downloadService.isChapterDownloaded(id);
      if (isDownloaded) {
        const offlineChapter = await this.downloadService.getChapter(id);
        if (offlineChapter) {
          this.objectUrls.forEach(url => URL.revokeObjectURL(url));
          this.objectUrls = [];

          const pages = offlineChapter.pages.map((blob, index) => {
            const url = URL.createObjectURL(blob);
            this.objectUrls.push(url);
            return { index: index.toString(), path: url };
          });

          const offlineBook = await this.downloadService.getBook(offlineChapter.bookId);

          const chapter: Chapter = {
            id: offlineChapter.id,
            bookId: offlineChapter.bookId,
            title: offlineChapter.title,
            index: offlineChapter.index,
            pages: pages,
            bookTitle: offlineBook?.title || '',
            totalChapters: offlineBook?.totalChapters || 0,
            originalUrl: '',
            next: offlineChapter.next,
            previous: offlineChapter.previous
          };

          this.chapter.set(chapter);
          this.updateMetadata(chapter);
          return;
        }
      }
    } catch (e) {
      console.error('Error loading offline chapter', e);
    }

    this.chapterService.getChapter(id).subscribe({
      next: (chapter: Chapter) => {
        this.chapter.set(chapter);
        this.updateMetadata(chapter);
      },
      error: (err: any) => {
        console.error('Erro ao carregar capítulo', err);
        this.notificationService.notify({
          message: 'Erro ao carregar o capítulo.',
          level: 'custom',
          severity: NotificationSeverity.CRITICAL
        });
      }
    });
  }

  private updateMetadata(chapter: Chapter) {
    if (chapter) {
      this.metaDataService.setMetaData({
        title: `${chapter.bookTitle} - ${chapter.title || 'Capítulo ' + chapter.index}`,
        description: `Leia o capítulo ${chapter.index} de ${chapter.bookTitle}`,
        image: chapter.pages?.[0]?.path || ''
      });
    }
  }

  refreshChapter() {
    const current = this.chapter();
    if (current) this.loadChapter(current.id);
  }

  scrollToTop() {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  startDrag(event: MouseEvent | TouchEvent) {
    const progressBar = this.progressBarRef()?.nativeElement;
    if (!progressBar) return;

    const calculateProgress = (clientX: number) => {
      const rect = progressBar.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      let percentage = (offsetX / rect.width) * 100;
      percentage = Math.max(0, Math.min(100, percentage));

      this.readingProgress.set(percentage);

      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrollTo = (percentage / 100) * windowHeight;
      window.scrollTo({ top: scrollTo, behavior: 'auto' });
    };

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      moveEvent.preventDefault();
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      calculateProgress(clientX);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);

    const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    calculateProgress(clientX);
  }

  private setupIntersectionObserver() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (!isPlatformBrowser(this.platformId)) return;

    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      if (this.isNavigating) return;

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);

          if (index > this.maxReadPageIndex) {
            this.maxReadPageIndex = index;
            const currentChapter = this.chapter();
            if (currentChapter) {
              this.readingProgressService.saveProgress(currentChapter.id, currentChapter.bookId, index);
            }
          }
        }
      });
    }, options);

    this.pageRefs.forEach((el: ElementRef) => {
      this.intersectionObserver?.observe(el.nativeElement);
    });
  }

  private async restoreReadingProgress() {
    const currentChapter = this.chapter();
    if (!currentChapter) return;

    const progress = await this.readingProgressService.getProgress(currentChapter.id);
    const totalPages = currentChapter.pages?.length || 0;
    const savedPageIndex = progress?.pageIndex || 0;

    const isLastPage = savedPageIndex >= totalPages - 1;
    const targetPageIndex = isLastPage ? 0 : savedPageIndex;

    this.maxReadPageIndex = targetPageIndex;

    if (targetPageIndex > 0) {
      const targetElement = this.pageRefs.get(targetPageIndex);
      if (targetElement) {
        targetElement.nativeElement.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }

  async nextPage() {
    const current = this.chapter();
    if (current?.next) {
      const isNextDownloaded = await this.downloadService.isChapterDownloaded(current.next);

      if (!isNextDownloaded && !navigator.onLine) {
        this.modalNotificationService.show(
          'Você chegou ao fim',
          'Você chegou ao último capítulo baixado e está sem internet.',
          [
            {
              label: 'Entendi',
              type: 'primary'
            }
          ],
          'warning'
        );
        return;
      }


      await this.markChapterAsCompleted();
      this.navigateToChapter(current.next);
    }
  }

  async previousPage() {
    const current = this.chapter();
    if (current?.previous) {
      await this.markChapterAsCompleted();
      this.navigateToChapter(current.previous);
    }
  }

  private async markChapterAsCompleted() {
    this.readingProgressService.cancelPendingSync();

    const current = this.chapter();
    if (current && current.pages) {
      const lastPageIndex = current.pages.length - 1;

      await this.readingProgressService.saveProgressImmediate(
        current.id,
        current.bookId,
        lastPageIndex,
        current.pages.length,
        true
      );
    }
  }

  private navigateToChapter(chapterId: string) {
    this.isNavigating = true;
    this.router.navigate(['../', chapterId], { relativeTo: this.activatedRoute }).then(() => {
      this.scrollToTop();
      setTimeout(() => {
        this.isNavigating = false;
      }, 500);
    });
  }

  backPage() {
    this.router.navigate(['../'], { relativeTo: this.activatedRoute });
  }

  resetChapter() {
    const current = this.chapter();
    if (current) {
      this.modalNotificationService.show(
        'Redefinir Capítulo',
        `Tem certeza que deseja redefinir este capítulo?`,
        [
          { label: 'Cancelar', type: 'primary' },
          {
            label: 'Redefinir',
            type: 'danger',
            callback: () => {
              this.chapterService.resetChapter(current.id).subscribe(() => {
                this.backPage();
              });
            }
          }
        ],
        'warning'
      );
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

  openOriginalLink() {
    const current = this.chapter();
    if (current && current.originalUrl) {
      window.open(current.originalUrl, '_blank');
    }
  }

  onContextMenu(event: MouseEvent, page: Page, index: number) {
    const currentChapter = this.chapter();
    if (!currentChapter) return;

    this.contextMenuService.open(event, [
      {
        label: 'Baixar Página',
        icon: 'download',
        action: () => {
          const filename = `Page ${index + 1} - Chapter ${currentChapter.index}.jpg`;
          this.downloadService.saveToDevice(page.path, filename);
        }
      },
      {
        label: 'Salvar Página',
        icon: 'bookmark',
        action: () => {
          if (!page.id) {
            this.notificationService.warning('Não é possível salvar páginas de capítulos baixados/offline. Tente ler online.');
            return;
          }

          this.notificationService.notify({
            message: '',
            level: 'custom',
            severity: NotificationSeverity.CRITICAL,
            component: PromptModalComponent,
            componentData: {
              title: 'Salvar Página',
              message: 'Deseja adicionar uma nota a esta página?',
              placeholder: 'Ex: Cena importante...',
              close: (comment: string | null) => {
                this.modalNotificationService.close();

                if (comment !== null) {
                  this.savedPagesService.savePage({
                    pageId: page.id!,
                    chapterId: currentChapter.id,
                    bookId: currentChapter.bookId,
                    comment: comment
                  }).subscribe({
                    next: () => {
                      this.notificationService.success('Página salva com sucesso!');
                    },
                    error: (err) => {
                      console.error('Error saving page', err);
                      if (err.status === 400) {
                        this.notificationService.info('Esta página já está salva.');
                      } else {
                        this.notificationService.error('Erro ao salvar página.');
                      }
                    }
                  });
                }
              }
            },
            useBackdrop: true,
            backdropOpacity: 0.5
          });
        }
      }
    ]);
  }
}
