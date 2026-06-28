import { Routes } from '@angular/router';
import { AllSettingsComponent } from './all-settings/all-settings.component';
import { AppearanceComponent } from './appearance/appearance.component';
import { FilterComponent } from './filter/filter.component';
import { ProfileComponent } from './profile/profile.component';
import { ReadingsComponent } from './readings/readings.component';
import { SecurityComponent } from './security/security.component';
import { NotificationsSettingsComponent } from './notifications/notifications.component';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'all',
	},
	{
		path: 'all',
		component: AllSettingsComponent,
	},
	{
		path: 'filter',
		component: FilterComponent,
	},
	{
		path: 'appearance',
		component: AppearanceComponent,
	},
	{
		path: 'readings',
		component: ReadingsComponent,
	},
	{
		path: 'profile',
		component: ProfileComponent,
	},
	{
		path: 'security',
		component: SecurityComponent,
	},
	{
		path: 'notifications',
		component: NotificationsSettingsComponent,
	},
];
