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
  Injector,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Chapter, ContentType } from '../../models/book.models';
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
import { NetworkStatusService } from '../../service/network-status.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, lastValueFrom } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { ContextMenuService } from '../../service/context-menu.service';
import { SavedPagesService } from '../../service/saved-pages.service';
import { Page } from '../../models/book.models';
import {
  ImageReaderComponent,
  TextReaderComponent,
  DocumentReaderComponent,
  ReadingProgressEvent,
  TextProgressEvent,
  DocumentProgressEvent
} from '../../components/readers';

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
    AsideComponent,
    ImageReaderComponent,
    TextReaderComponent,
    DocumentReaderComponent
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
  private networkStatus = inject(NetworkStatusService);
  private cdr = inject(ChangeDetectorRef);
  private injector = inject(Injector);

  progressBarRef = viewChild<ElementRef>('progressBarRef');
  @ViewChildren('pageRef') pageRefs!: QueryList<ElementRef>;
  @ViewChild(ImageReaderComponent) imageReader?: ImageReaderComponent;
  @ViewChild(TextReaderComponent) textReader?: TextReaderComponent;
  @ViewChild(DocumentReaderComponent) documentReader?: DocumentReaderComponent;

  chapter = signal<Chapter | null>(null);
  readingProgress = signal<number>(0);
  showScrollToTopButton = signal<boolean>(false);
  savedPageIndex = signal<number>(0);

  private pageObjectUrls: string[] = [];
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
          this.showScrollToTopButton.set(true);
        } else {
          this.showScrollToTopButton.set(false);
        }

        this.lastScrollPosition = currentScroll;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.pageObjectUrls.forEach(url => URL.revokeObjectURL(url));
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

  async loadChapter(id: string, forceOnline = false) {
    this.maxReadPageIndex = 0;
    try {
      const chapter = await this.resolveChapterData(id, forceOnline);
      if (chapter) {
        this.chapter.set(chapter);
        this.updateMetadata(chapter);
      }
    } catch (e) {
      console.error('Erro ao carregar capítulo', e);
      this.notificationService.notify({
        message: 'Erro ao carregar o capítulo.',
        level: 'custom',
        severity: NotificationSeverity.CRITICAL
      });
    }
  }

  private async resolveChapterData(id: string, forceOnline: boolean): Promise<Chapter | null> {
    if (!forceOnline) {
      const isDownloaded = await this.downloadService.isChapterDownloaded(id);
      if (isDownloaded) {
        return this.loadOfflineChapter(id);
      }
    }
    return lastValueFrom(this.chapterService.getChapter(id));
  }

  private async loadOfflineChapter(id: string): Promise<Chapter | null> {
    try {
      const offlineChapter = await this.downloadService.getChapter(id);
      if (!offlineChapter) return null;

      this.pageObjectUrls.forEach(url => URL.revokeObjectURL(url));
      this.pageObjectUrls = [];

      const pages = offlineChapter.pages.map((blob, index) => {
        const url = URL.createObjectURL(blob);
        this.pageObjectUrls.push(url);
        return { index: index.toString(), path: url };
      });

      const offlineBook = await this.downloadService.getBook(offlineChapter.bookId);

      return {
        id: offlineChapter.id,
        bookId: offlineChapter.bookId,
        title: offlineChapter.title,
        index: offlineChapter.index,
        pages: pages,
        bookTitle: offlineBook?.title || '',
        totalChapters: offlineBook?.totalChapters || 0,
        originalUrl: '',
        next: offlineChapter.next,
        previous: offlineChapter.previous,
        contentType: offlineChapter.contentType || 'image',
        content: offlineChapter.content,
        contentFormat: offlineChapter.contentFormat,
        documentPath: offlineChapter.document ? URL.createObjectURL(offlineChapter.document) : undefined,
        documentFormat: offlineChapter.documentFormat
      };
    } catch (e) {
      console.error('Error loading offline chapter', e);
      return null;
    }
  }

  // === Progress handlers for different reader types ===

  private updateProgressState(pageIndex: number, visualProgressPercentage: number) {
    if (this.isNavigating) return;

    const currentChapter = this.chapter();
    if (!currentChapter) return;

    // Atualiza progresso visual
    this.readingProgress.set(visualProgressPercentage);

    // Persistência inteligente (apenas se avançou)
    if (pageIndex > this.maxReadPageIndex) {
      this.maxReadPageIndex = pageIndex;
      this.readingProgressService.saveProgress(currentChapter.id, currentChapter.bookId, pageIndex);
    }
  }

  onImageProgress(event: ReadingProgressEvent) {
    const percent = ((event.pageIndex + 1) / event.totalPages) * 100;
    this.updateProgressState(event.pageIndex, percent);
  }

  onTextProgress(event: TextProgressEvent) {
    this.updateProgressState(event.pageIndex, event.scrollPercentage);
  }

  onDocumentProgress(event: DocumentProgressEvent) {
    const percent = ((event.pageIndex + 1) / event.totalPages) * 100;
    this.updateProgressState(event.pageIndex, percent);
  }

  getContentType(): ContentType {
    return this.chapter()?.contentType || 'image';
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
    await this.handleChapterTransition('next');
  }

  async previousPage() {
    await this.handleChapterTransition('previous');
  }

  private async handleChapterTransition(direction: 'next' | 'previous') {
    const current = this.chapter();
    if (!current) return;

    const targetChapterId = direction === 'next' ? current.next : current.previous;
    if (!targetChapterId) return;

    if (direction === 'next') {
      const isNextDownloaded = await this.downloadService.isChapterDownloaded(targetChapterId);
      if (!isNextDownloaded && this.networkStatus.isOffline()) {
        this.modalNotificationService.show(
          'Você chegou ao fim',
          'Você chegou ao último capítulo baixado e está sem internet.',
          [{ label: 'Entendi', type: 'primary' }],
          'warning'
        );
        return;
      }
    }

    await this.markChapterAsCompleted();
    this.navigateToChapter(targetChapterId);
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
            this.loadChapter(currentChapter.id, true).then(() => {
              const updatedChapter = this.chapter();
              if (updatedChapter) {
                const updatedPage = updatedChapter.pages.find(p => p.index === page.index);
                if (updatedPage && updatedPage.id) {
                  this.savePage(updatedPage, currentChapter);
                } else {
                  this.notificationService.warning('Não foi possível obter os dados da página. Verifique sua conexão.');
                }
              }
            });
            return;
          }

          this.savePage(page, currentChapter);
        }
      }
    ]);
  }

  private lastTapTime = 0;

  onZoneTouch(event: TouchEvent) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - this.lastTapTime;

    if (tapLength < 300 && tapLength > 0) {
      this.nextPage();
      if (event.cancelable) {
        event.preventDefault();
      }
    }
    this.lastTapTime = currentTime;
  }

  private savePage(page: Page, chapter: Chapter) {
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
              chapterId: chapter.id,
              bookId: chapter.bookId,
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
