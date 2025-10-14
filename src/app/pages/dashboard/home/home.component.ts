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
  overview!: DashboardOverview;
  progressBooks!: DashboardProgress;
  constructor(
    private readonly dashboardService: DashboardService,
    private metaService: MetaDataService
  ) {
    this.dashboardService.getOverview().subscribe((overview) => {
      this.overview = overview;
    });
    this.dashboardService.getProgressBooks().subscribe((progressBooks) => {
      this.progressBooks = progressBooks;
    });
    this.setMetaData();
  }
  setMetaData() {
    this.metaService.setMetaData({
      title: 'Dashboard',
      description: 'Visão geral do seu painel. Acompanhe estatísticas, progresso e atividades recentes.',
    });
  }

}
