import { Component, ElementRef, Input, ViewChild, AfterViewInit, signal, OnDestroy, inject } from '@angular/core';
import { BookService } from '../../service/book.service';
import { Book, BookBasic, BookDetail, Chapter, Chapterlist, Cover, ScrapingStatus } from '../../models/book.models';
import { RouterModule } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { IconsComponent } from '../icons/icons.component';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { Subscription } from 'rxjs';
import { DownloadService } from '../../service/download.service';
import { ChapterService } from '../../service/chapter.service';
import { DownloadStatus } from '../../models/offline.models';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { ContextMenuService } from '../../service/context-menu.service';
import { ContextMenuItem } from '../../models/context-menu.models';
import { UserTokenService } from '../../service/user-token.service';

enum tab {
  chapters = 0,
  covers = 1,
  extraInfo = 2
}

interface ModulesLoad {
  load: ReturnType<typeof signal<boolean>>;
  function: () => Promise<any>;
}

@Component({
  selector: 'app-info-book',
  imports: [RouterModule, DecimalPipe, IconsComponent, ButtonComponent],
  templateUrl: './info-book.component.html',
  styleUrl: './info-book.component.scss'
})
export class InfoBookComponent implements AfterViewInit, OnDestroy {
  private userTokenService = inject(UserTokenService);

  tab = tab;
  ScrapingStatus = ScrapingStatus;

  @Input() id!: string;
  @Input() bookBasic?: BookBasic;

  selectedTab: tab = tab.chapters;
  sortAscending = signal(false);

  private websocketSubscription?: Subscription;
  private downloadSubscription?: Subscription;

  modulesLoad: ModulesLoad[] = [
    {
      load: signal(false),
      function: async () => this.loadChapters()
    },
    {
      load: signal(false),
      function: async () => this.loadCovers()
    },
    {
      load: signal(false),
      function: async () => this.loadExtraInfo()
    }
  ];
  chapters: Chapterlist[] = [];
  covers: Cover[] = [];
  extraInfo: BookDetail = {
    alternativeTitle: [],
    originalUrl: [],
    scrapingStatus: ScrapingStatus.PROCESSING,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  chaptersDownloadStatus = new Map<string, DownloadStatus | 'downloaded'>();
  chaptersDownloadProgress = new Map<string, number>();

  @ViewChild('selector') selector!: ElementRef<HTMLDivElement>;
  @ViewChild('firstTab') firstTab!: ElementRef<HTMLSpanElement>;

  constructor(
    private bookService: BookService,
    private modalService: ModalNotificationService,
    private downloadService: DownloadService,
    private chapterService: ChapterService,
    private contextMenuService: ContextMenuService
  ) {}

  ngAfterViewInit() {
    if (this.firstTab) {
      this.firstTab.nativeElement.click();
    }

    this.subscribeToWebSocketEvents();

    this.downloadSubscription = this.downloadService.downloadProgress$.subscribe((progressMap) => {
      progressMap.forEach((progress, chapterId) => {
        this.chaptersDownloadStatus.set(chapterId, progress.status);
        if (progress.total > 0) {
          this.chaptersDownloadProgress.set(chapterId, (progress.current / progress.total) * 100);
        }

        if (progress.status === 'completed') {
          this.chaptersDownloadStatus.set(chapterId, 'downloaded');
        }
      });
    });
  }

  ngOnDestroy() {
    if (this.websocketSubscription) {
      this.websocketSubscription.unsubscribe();
    }
    if (this.downloadSubscription) {
      this.downloadSubscription.unsubscribe();
    }
  }

  private subscribeToWebSocketEvents() {
    if (!this.id) return;

    this.websocketSubscription = this.bookService.watchBook(this.id).subscribe({
      next: (event) => {
        console.log('📡 Evento WebSocket recebido:', event);

        switch (event.type) {
          case 'chapters.updated':
            if (this.selectedTab === tab.chapters && this.modulesLoad[tab.chapters].load()) {
              this.loadChapters();
            } else {
              this.modulesLoad[tab.chapters].load.set(false);
            }
            break;

          case 'cover.processed':
          case 'cover.selected':
            if (this.selectedTab === tab.covers && this.modulesLoad[tab.covers].load()) {
              this.loadCovers();
            } else {
              this.modulesLoad[tab.covers].load.set(false);
            }
            break;

          case 'book.updated':
            if (this.selectedTab === tab.extraInfo && this.modulesLoad[tab.extraInfo].load()) {
              this.loadExtraInfo();
            } else {
              this.modulesLoad[tab.extraInfo].load.set(false);
            }
            break;
        }
      },
      error: (error) => {
        console.error('❌ Erro no WebSocket:', error);
      }
    });
  }

  selectTab(tabName: tab, event?: Event) {
    this.selectedTab = tabName;
    this.loadResults(tabName);

    if (event && this.selector) {
      const clickedElement = event.target as HTMLSpanElement;
      const headerElement = clickedElement.parentElement;

      if (headerElement) {
        const clickedRect = clickedElement.getBoundingClientRect();
        const headerRect = headerElement.getBoundingClientRect();

        const relativeLeft = clickedRect.left - headerRect.left;
        const width = clickedRect.width;

        const selectorEl = this.selector.nativeElement;
        selectorEl.style.left = `${relativeLeft}px`;
        selectorEl.style.width = `${width}px`;
      }
    }
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

  loadResults(index: number) {
    if (this.modulesLoad[index] && !this.modulesLoad[index].load()) {
      this.modulesLoad[index].function();
      this.modulesLoad[index].load.set(true);
    }
  }

  toggleSort() {
    this.sortAscending.update((v) => !v);
    this.sortChapters();
  }

  sortChapters() {
    const asc = this.sortAscending();
    this.chapters.sort((a, b) => (asc ? a.index - b.index : b.index - a.index));
  }

  loadChapters() {
    this.bookService.getChapters(this.id).subscribe({
      next: (chapters) => {
        this.chapters = chapters;
        this.sortChapters();
        this.checkDownloadedChapters();
      },
      error: async (error) => {
        console.error('Error loading chapters from API, trying offline:', error);
        try {
          const offlineChapters = await this.downloadService.getChaptersByBook(this.id);
          if (offlineChapters && offlineChapters.length > 0) {
            this.chapters = offlineChapters.map(oc => ({
              id: oc.id,
              title: oc.title,
              index: oc.index,
              originalUrl: '',
              scrapingStatus: ScrapingStatus.READY,
              read: false
            }));

            this.sortChapters();

            this.chapters.forEach(c => this.chaptersDownloadStatus.set(c.id, 'downloaded'));
          }
        } catch (e) {
          console.error('Error loading offline chapters', e);
        }
      }
    });
  }

  async checkDownloadedChapters() {
    for (const chapter of this.chapters) {
      const isDownloaded = await this.downloadService.isChapterDownloaded(chapter.id);
      if (isDownloaded) {
        this.chaptersDownloadStatus.set(chapter.id, 'downloaded');
      }
    }
  }

  async downloadChapter(chapterList: Chapterlist, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.chaptersDownloadStatus.get(chapterList.id) === 'downloaded' ||
      this.chaptersDownloadStatus.get(chapterList.id) === 'downloading') {
      return;
    }

    if (!this.bookBasic) {
      console.error('Book basic info not available');
      return;
    }

    // Convert BookBasic to Book structure required by DownloadService (partial is fine if consistent)
    // We need a full Book object mostly for storage metadata.
    // Since we don't have the full Book object here, we construct what we can or fetch it.
    // However, DownloadService.saveBook takes a "Book". Let's see if we can cast or fetch.

    // Fetch full chapter details first
    this.chapterService.getChapter(chapterList.id).subscribe({
      next: async (fullChapter) => {
        // We need the book object.
        // Let's construct a Book object from BookBasic + defaults if needed, or fetch the full book.
        // Since fetching the full book is safer:
        this.bookService.getBook(this.id).subscribe({
          next: async (fullBookBasic) => {
            // BookBasic is what we have. The DownloadService expects 'Book' interface which has 'chapters'.
            // But for saving the book metadata, BookBasic is almost enough except for 'chapters'.
            // Let's cast it as Book because we only save metadata fields in saveBook.
            // Or better, update DownloadService to accept BookBasic.
            // For now, let's cast.
            const bookToSave = fullBookBasic as unknown as Book;

            try {
              await this.downloadService.downloadChapter(bookToSave, fullChapter);
            } catch (e) {
              console.error('Download failed', e);
            }
          }
        })
      },
      error: (err) => console.error('Failed to get chapter details', err)
    });
  }

  loadCovers() {
    this.bookService.getCovers(this.id).subscribe({
      next: (covers) => {
        this.covers = covers;
      },
      error: (error) => {
        console.error('Error loading covers:', error);
      }
    });
  }

  loadExtraInfo() {
    this.bookService.getInfo(this.id).subscribe({
      next: (info) => {
        this.extraInfo = info;
      },
      error: (error) => {
        console.error('Error loading extra info:', error);
      }
    });
  }

  urlTransform(url: string): string {
    return new URL(url).hostname;
  }

  onCoverContextMenu(event: MouseEvent, cover: Cover) {
    const items: ContextMenuItem[] = [
      {
        label: 'Copiar Imagem',
        icon: 'file',
        action: () => this.copyImage(cover.url)
      }
    ];

    if (this.userTokenService.isAdminSignal()) {
      items.push(
        { type: 'separator' },
        {
          label: 'Selecionar Capa',
          icon: 'image',
          action: () => this.selectCover(cover)
        },
        {
          label: 'Editar',
          icon: 'settings',
          action: () => console.log('Edit cover', cover.id)
        }
      );
    }

    this.contextMenuService.open(event, items);
  }

  copyImage(url: string) {
    navigator.clipboard.writeText(url).then(() => {
       // console.log('Image URL copied');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  selectCover(cover: Cover) {
    this.modalService.show(
      'Confirmar troca de capa',
      'Tem certeza que deseja trocar a capa do livro?',
      [
        {
          label: 'Cancelar',
          type: 'primary',
        },
        {
          label: 'Sim',
          type: 'danger',
          callback: () => {
            this.bookService.selectCover(this.id, cover.id).subscribe({
              next: (book) => {
                window.location.reload();
              }
            });
          }
        }
      ]
    );
  }
}
