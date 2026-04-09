import { Routes } from '@angular/router';
import { ProfileComponent } from './profile/profile.component';
import { FilterComponent } from './filter/filter.component';
import { SecurityComponent } from './security/security.component';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'filter',
	},
	{
		path: 'filter',
		component: FilterComponent,
	},
	{
		path: 'profile',
		component: ProfileComponent,
	},
	{
		path: 'security',
		component: SecurityComponent,
	},
];
