import { Component, ElementRef, Input, ViewChild, AfterViewInit, signal, OnDestroy, inject } from '@angular/core';
import { BookService } from '../../service/book.service';
import { Book, BookBasic, BookDetail, Chapterlist, Cover, ScrapingStatus } from '../../models/book.models';
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
import { ImageViewerComponent } from '../image-viewer/image-viewer.component';
import { CoverEditModalComponent, CoverEditSaveEvent } from '../cover-edit-modal/cover-edit-modal.component';

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
  imports: [RouterModule, DecimalPipe, IconsComponent, ButtonComponent, ImageViewerComponent, CoverEditModalComponent],
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
  sortAscending = signal(true);

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

  // Image viewer state
  showImageViewer = false;
  viewerImageUrl = '';
  viewerImageTitle = '';

  // Cover edit modal state
  showCoverEditModal = false;
  editingCover: Cover | null = null;

  // Track cover image loading errors
  coverImageErrors = new Set<string>();

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

  async deleteChapterDownload(chapter: Chapterlist, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    this.modalService.show(
      'Excluir Download',
      `Deseja excluir o capítulo ${chapter.index}${chapter.title ? ` - ${chapter.title}` : ''} dos downloads?`,
      [
        {
          label: 'Cancelar',
          type: 'primary',
        },
        {
          label: 'Excluir',
          type: 'danger',
          callback: async () => {
            await this.downloadService.deleteChapter(chapter.id);
            this.chaptersDownloadStatus.delete(chapter.id);
            // Força atualização da view
            this.chaptersDownloadStatus = new Map(this.chaptersDownloadStatus);
          }
        }
      ],
      'warning'
    );
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

  onCoverImageError(coverId: string) {
    this.coverImageErrors.add(coverId);
  }

  onCoverContextMenu(event: MouseEvent, cover: Cover) {
    const items: ContextMenuItem[] = [];

    // Only show image-related options if cover has a URL and no error
    if (cover.url && !this.coverImageErrors.has(cover.id)) {
      items.push(
        {
          label: 'Copiar Imagem',
          icon: 'copy',
          action: () => this.copyImage(cover.url)
        },
        {
          label: 'Baixar Imagem',
          icon: 'download',
          action: () => this.downloadImage(cover.url, cover.title || `cover-${cover.id}`)
        }
      );
    }

    if (this.userTokenService.isAdminSignal()) {
      if (items.length > 0) {
        items.push({ type: 'separator' });
      }

      if (cover.url) {
        items.push({
          label: 'Selecionar Capa',
          icon: 'image',
          action: () => this.selectCover(cover)
        });
      }

      items.push(
        {
          label: 'Editar',
          icon: 'settings',
          action: () => this.openCoverEditModal(cover)
        },
        { type: 'separator' },
        {
          label: 'Remover',
          icon: 'close',
          danger: true,
          action: () => this.confirmDeleteCover(cover)
        }
      );
    }

    this.contextMenuService.open(event, items);
  }

  onCoverClick(cover: Cover) {
    if (cover.url && !this.coverImageErrors.has(cover.id)) {
      this.openImageViewer(cover.url, cover.title);
    } else {
      // Open edit modal for covers without image or with loading error
      this.openCoverEditModal(cover);
    }
  }

  openImageViewer(url: string, title: string) {
    this.viewerImageUrl = url;
    this.viewerImageTitle = title;
    this.showImageViewer = true;
    this.lockScroll();
  }

  closeImageViewer() {
    this.showImageViewer = false;
    this.viewerImageUrl = '';
    this.viewerImageTitle = '';
    this.unlockScroll();
  }

  private lockScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  private unlockScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  openCoverEditModal(cover: Cover) {
    this.editingCover = cover;
    this.showCoverEditModal = true;
    this.lockScroll();
  }

  closeCoverEditModal() {
    this.showCoverEditModal = false;
    this.editingCover = null;
    this.unlockScroll();
  }

  onCoverEditSave(data: CoverEditSaveEvent) {
    if (data.file) {
      // Replace existing cover image
      this.bookService.replaceCoverImage(this.id, data.id, data.file, data.title).subscribe({
        next: (updatedCover) => {
          const coverIndex = this.covers.findIndex(c => c.id === data.id);
          if (coverIndex !== -1) {
            // Add cache-busting parameter to force image reload
            if (updatedCover.url && !updatedCover.url.includes('?')) {
              updatedCover.url = `${updatedCover.url}?t=${Date.now()}`;
            }
            this.covers[coverIndex] = updatedCover;
            // Clear any previous image error for this cover
            this.coverImageErrors.delete(data.id);
          }
          this.closeCoverEditModal();
        },
        error: (error: Error) => {
          console.error('Error replacing cover image:', error);
        }
      });
    } else {
      // Just update the title
      this.bookService.updateCover(this.id, data.id, { title: data.title }).subscribe({
        next: () => {
          const coverIndex = this.covers.findIndex(c => c.id === data.id);
          if (coverIndex !== -1) {
            this.covers[coverIndex].title = data.title;
          }
          this.closeCoverEditModal();
        },
        error: (error: Error) => {
          console.error('Error updating cover:', error);
        }
      });
    }
  }

  confirmDeleteCover(cover: Cover) {
    this.modalService.show(
      'Remover Capa',
      `Tem certeza que deseja remover esta capa${cover.title ? ` "${cover.title}"` : ''}?`,
      [
        {
          label: 'Cancelar',
          type: 'primary',
        },
        {
          label: 'Remover',
          type: 'danger',
          callback: () => this.deleteCover(cover)
        }
      ]
    );
  }

  deleteCover(cover: Cover) {
    this.bookService.deleteCover(this.id, cover.id).subscribe({
      next: () => {
        this.covers = this.covers.filter(c => c.id !== cover.id);
      },
      error: (error: Error) => {
        console.error('Error deleting cover:', error);
      }
    });
  }

  copyImage(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      // console.log('Image URL copied');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  async downloadImage(url: string, filename: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const extension = blob.type.split('/')[1] || 'jpg';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Failed to download image: ', err);
    }
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
