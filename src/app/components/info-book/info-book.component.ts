import { Component, ElementRef, Input, ViewChild, AfterViewInit, signal, OnDestroy } from '@angular/core';
import { BookService } from '../../service/book.service';
import { BookDetail, Chapterlist, Cover, ScrapingStatus } from '../../models/book.models';
import { RouterModule } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { IconsComponent } from '../icons/icons.component';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { Subscription } from 'rxjs';

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
  imports: [RouterModule, DecimalPipe, IconsComponent],
  templateUrl: './info-book.component.html',
  styleUrl: './info-book.component.scss'
})
export class InfoBookComponent implements AfterViewInit, OnDestroy {
  tab = tab;
  ScrapingStatus = ScrapingStatus;

  @Input() id!: string;
  selectedTab: tab = tab.chapters;

  private websocketSubscription?: Subscription;

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

  @ViewChild('selector') selector!: ElementRef<HTMLDivElement>;
  @ViewChild('firstTab') firstTab!: ElementRef<HTMLSpanElement>;

  constructor(
    private bookService: BookService,
    private modalService: ModalNotificationService,
  ) {}

  ngAfterViewInit() {
    if (this.firstTab) {
      this.firstTab.nativeElement.click();
    }

    this.subscribeToWebSocketEvents();
  }

  ngOnDestroy() {
    if (this.websocketSubscription) {
      this.websocketSubscription.unsubscribe();
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

  loadChapters() {
    this.bookService.getChapters(this.id).subscribe({
      next: (chapters) => {
        this.chapters = chapters;
      },
      error: (error) => {
        console.error('Error loading chapters:', error);
      }
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
