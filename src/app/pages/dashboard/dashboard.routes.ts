import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { MonitoringComponent } from './monitoring/monitoring.component';
import { TagsComponent } from './tags/tags.component';

export const dashboardRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'home',
	},
	{
		path: 'home',
		component: HomeComponent,
	},
	{
		path: 'tags',
		component: TagsComponent,
	},
	{
		path: 'monitoring',
		component: MonitoringComponent,
	},
	{
		path: 'sensitive-content',
		loadComponent: () =>
			import('./sensitive-content/sensitive-content.component').then(
				(m) => m.SensitiveContentComponent,
			),
	},
];
