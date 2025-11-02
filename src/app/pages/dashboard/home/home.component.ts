import { Component, OnInit, OnDestroy } from '@angular/core';
import { IconsComponent } from '../../../components/icons/icons.component';
import { DashboardService } from '../../../service/dashboard.service';
import { DashboardOverview, DashboardProgress } from '../../../models/dashboard.models';
import { RouterModule } from '@angular/router';
import { MetaDataService } from '../../../service/meta-data.service';
import { BookWebsocketService } from '../../../service/book-websocket.service';
import { UserTokenService } from '../../../service/user-token.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-home',
  imports: [
    IconsComponent,
    RouterModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  overview: DashboardOverview = {
    books: 0,
    chapters: 0,
    pages: 0,
    tags: 0,
    authors: 0,
    sensitiveContent: 0
  };

  progressBooks: DashboardProgress = {
    totalChapters: 0,
    processingChapters: 0,
    books: []
  };

  private wsSubscriptions: Subscription[] = [];

  constructor(
    private readonly dashboardService: DashboardService,
    private metaService: MetaDataService,
    private wsService: BookWebsocketService,
    private userTokenService: UserTokenService
  ) {
    this.setMetaData();
  }

  ngOnInit() {
    this.loadDashboardData();

    // Se for admin, conecta ao WebSocket para receber eventos globais
    if (this.userTokenService.isAdmin()) {
      this.setupWebSocket();
    }
  }

  ngOnDestroy() {
    this.wsSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private setupWebSocket() {
    // Conecta ao WebSocket
    if (!this.wsService.isConnected()) {
      this.wsService.connect();
    }

    // Admin recebe eventos globais automaticamente
    this.wsSubscriptions.push(
      this.wsService.bookCreated$.subscribe(book => {
        console.log('📚 Novo livro criado:', book.title);
        this.loadDashboardData(); // Recarrega dashboard
      }),

      this.wsService.chaptersUpdated$.subscribe(data => {
        console.log('📖 Capítulos atualizados no livro:', data.bookId);
        this.loadDashboardData();
      }),

      this.wsService.chapterScrapingCompleted$.subscribe(data => {
        console.log('✅ Scraping completo:', data.chapterId);
        this.loadDashboardData();
      }),

      this.wsService.chaptersFix$.subscribe(data => {
        console.log('🔧 Capítulos precisam correção:', data.chapterIds);
      })
    );
  }

  private loadDashboardData(): void {
    this.dashboardService.getOverview().subscribe({
      next: (overview) => {
        this.overview = overview;
      },
      error: (error) => {
        console.error('Erro ao carregar overview do dashboard:', error);
      }
    });

    this.dashboardService.getProgressBooks().subscribe({
      next: (progressBooks) => {
        this.progressBooks = progressBooks;
      },
      error: (error) => {
        console.error('Erro ao carregar livros em processamento:', error);
      }
    });
  }

  setMetaData() {
    this.metaService.setMetaData({
      title: 'Dashboard',
      description: 'Visão geral do seu painel. Acompanhe estatísticas, progresso e atividades recentes.',
    });
  }

}
