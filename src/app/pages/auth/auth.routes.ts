import { Routes } from '@angular/router';
import { isNotLoggedMatchGuard } from '@features/authentication/guards/auth.guard';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

export const authRoutes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: '404',
	},
	{
		path: 'login',
		component: LoginComponent,
		canMatch: [isNotLoggedMatchGuard],
	},
	{
		path: 'register',
		component: RegisterComponent,
		canMatch: [isNotLoggedMatchGuard],
	},
];
