import { Component } from '@angular/core';
import { IconsComponent } from '../../../components/icons/icons.component';
import { DashboardService } from '../../../service/dashboard.service';
import { DashboardOverview, DashboardProgress } from '../../../models/dashboard.models';
import { RouterModule } from '@angular/router';
import { MetaDataService } from '../../../service/meta-data.service';


@Component({
  selector: 'app-home',
  imports: [
    IconsComponent,
    RouterModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
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

  constructor(
    private readonly dashboardService: DashboardService,
    private metaService: MetaDataService
  ) {
    this.loadDashboardData();
    this.setMetaData();
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
