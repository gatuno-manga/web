import { Component } from '@angular/core';
import { IconsComponent } from '../../../components/icons/icons.component';
import { DashboardService } from '../../../service/dashboard.service';
import { DashboardOverview, DashboardProgress } from '../../../models/dashboard.models';
import { RouterModule } from '@angular/router';


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
  ) {
    this.dashboardService.getOverview().subscribe((overview) => {
      this.overview = overview;
    });
    this.dashboardService.getProgressBooks().subscribe((progressBooks) => {
      this.progressBooks = progressBooks;
    });
  }

}
