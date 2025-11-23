import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
  computed,
  effect
} from '@angular/core';
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
import { BookWebsocketService } from '../../service/book-websocket.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

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
export class ChaptersComponent implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private chapterService = inject(ChapterService);
  private userTokenService = inject(UserTokenService);
  private modalNotificationService = inject(ModalNotificationService);
  private notificationService = inject(NotificationService);
  private metaDataService = inject(MetaDataService);
  private settingsService = inject(SettingsService);
  private bookWebsocketService = inject(BookWebsocketService);
  private router = inject(Router);

  // Queries
  progressBarRef = viewChild<ElementRef>('progressBarRef');

  // State Signals
  chapter = signal<Chapter | null>(null);
  readingProgress = signal<number>(0);
  showBtnTop = signal<boolean>(false);

  // Converte o Observable de settings para Signal
  settings = toSignal(this.settingsService.settings$, {
    initialValue: this.settingsService.getSettings()
  });

  // Computed
  filterStyle = computed(() => {
    const s = this.settings();
    const parts: string[] = [];
    if (s.brightness != null) parts.push(`brightness(${s.brightness}%)`);
    if (s.contrast != null) parts.push(`contrast(${s.contrast}%)`);
    if (s.grayScale) parts.push(`grayscale(100%)`);
    if (s.invert != null && s.invert > 0) parts.push(`invert(${s.invert}%)`);
    return parts.length > 0 ? parts.join(' ') : 'none';
  });

  admin = this.userTokenService.isAdmin();

  constructor() {
    // Router params subscription
    this.activatedRoute.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const chapterId = params.get('chapter'); // Original usava 'chapter'
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
  }

  ngOnInit(): void {}

  // Corrigido: Removido ['$event'] pois não é usado e causava erro de aridade
  @HostListener('window:scroll')
  onWindowScroll() {
    const scrollPosition = window.scrollY || document.documentElement.scrollTop || 0;
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

    this.showBtnTop.set(scrollPosition > 400);

    if (windowHeight > 0) {
      const progress = (scrollPosition / windowHeight) * 100;
      this.readingProgress.set(progress);
    }
  }

  private setupWebSocket(chapterId: string, bookId: string) {
    if (!this.bookWebsocketService.isConnected()) {
      this.bookWebsocketService.connect();
    }

    // Reimplementando lógica do WebSocket com takeUntilDestroyed
    this.bookWebsocketService.watchChapter(chapterId, bookId)
      .pipe(takeUntilDestroyed())
      .subscribe((event: any) => {
        if (event.type === 'chapter.updated' || event.type === 'chapter.scraping.completed') {
          this.refreshChapter();
        }
      });
  }

  loadChapter(id: string) {
    // Corrigido: getById -> getChapter
    this.chapterService.getChapter(id).subscribe({
      next: (chapter: Chapter) => {
        this.chapter.set(chapter);

        if (chapter) {
          // Corrigido: updateMetaData -> setMetaData
          // Corrigido: .url -> .path
          this.metaDataService.setMetaData({
            title: `${chapter.bookTitle} - ${chapter.title || 'Capítulo ' + chapter.index}`,
            description: `Leia o capítulo ${chapter.index} de ${chapter.bookTitle}`,
            image: chapter.pages?.[0]?.path || ''
          });
        }
      },
      error: (err: any) => {
        console.error('Erro ao carregar capítulo', err);
        // Corrigido: Adicionado 'level' e ajustado 'severity'
        this.notificationService.notify({
          message: 'Erro ao carregar o capítulo.',
          level: 'custom',
          severity: NotificationSeverity.CRITICAL // Usando CRITICAL pois ERROR não existia no enum
        });
      }
    });
  }

  refreshChapter() {
    const current = this.chapter();
    if (current) this.loadChapter(current.id);
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  nextPage() {
    const current = this.chapter();
    if (current?.next) {
      this.navigateToChapter(current.next);
    }
  }

  previousPage() {
    const current = this.chapter();
    if (current?.previous) {
      this.navigateToChapter(current.previous);
    }
  }

  private navigateToChapter(chapterId: string) {
    this.router.navigate(['../', chapterId], { relativeTo: this.activatedRoute }).then(() => {
      this.scrollToTop();
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
}
