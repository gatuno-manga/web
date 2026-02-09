import { Routes } from '@angular/router';
import { RenderMode } from '@angular/ssr';
import { networkGuard } from './guards/network.guard';

/**
 * Helpers para configuração de SSR e Cache
 * Melhora a legibilidade e facilita a manutenção dos tempos de cache.
 */
const PRE_RENDER_CONFIG = (key: string) => ({
	ssr: {
		renderMode: RenderMode.Prerender,
		cache: {
			key,
			ttl: 60 * 60 * 24, // 24 horas
		},
	},
});

const SERVER_RENDER_CONFIG = (key: string) => ({
	ssr: {
		renderMode: RenderMode.Server,
		cache: {
			key,
			ttl: 60 * 60, // 1 hora
		},
	},
});

export const routes: Routes = [
	{
		path: '',
		loadComponent: () =>
			import(
				'./pages/outlet/default-outlet/default-outlet.component'
			).then((m) => m.DefaultOutletComponent),
		children: [
			{
				path: '',
				redirectTo: 'home',
				pathMatch: 'full',
			},
			{
				path: 'home',
				loadComponent: () =>
					import('./pages/home/home.component').then(
						(m) => m.HomeComponent,
					),
				data: PRE_RENDER_CONFIG('home'),
			},
			{
				path: 'books',
				loadComponent: () =>
					import('./pages/books/books.component').then(
						(m) => m.BooksComponent,
					),
			},
			{
				path: 'books/:id',
				loadComponent: () =>
					import('./pages/book/book.component').then(
						(m) => m.BookComponent,
					),
				data: SERVER_RENDER_CONFIG('book'),
			},
			{
				path: 'user',
				loadComponent: () =>
					import('./pages/user/outlet/outlet.component').then(
						(m) => m.OutletComponent,
					),
				data: { ssr: { renderMode: RenderMode.Client } },
				loadChildren: () =>
					import('./pages/user/user.routes').then((m) => m.routes),
			},
		],
	},
	{
		path: 'books/:id/:chapter',
		loadComponent: () =>
			import('./pages/chapters/chapters.component').then(
				(m) => m.ChaptersComponent,
			),
		data: SERVER_RENDER_CONFIG('chapter'),
	},
	{
		path: 'auth',
		loadComponent: () =>
			import('./pages/auth/outlet/outlet.component').then(
				(m) => m.OutletComponent,
			),
		loadChildren: () =>
			import('./pages/auth/auth.routes').then((m) => m.routes),
	},
	{
		path: 'dashboard',
		loadComponent: () =>
			import(
				'./pages/outlet/default-outlet/default-outlet.component'
			).then((m) => m.DefaultOutletComponent),
		canActivate: [networkGuard],
		loadChildren: () =>
			import('./pages/dashboard/dashboard.routes').then((m) => m.routes),
	},
];
