import { Routes } from '@angular/router';
import { RenderMode, ServerRoute } from '@angular/ssr';
import { DefaltOutletComponent } from './pages/outlet/defalt-outlet/defalt-outlet.component';
import { BookComponent } from './pages/book/book.component';
import { BooksComponent } from './pages/books/books.component';
import { ChaptersComponent } from './pages/chapters/chapters.component';
import { HomeComponent } from './pages/home/home.component';
import { OutletComponent as OutletAuht } from './pages/auth/outlet/outlet.component';
import { OutletComponent as OutletUser } from './pages/user/outlet/outlet.component';

export const routes: Routes = [
  {
    path: '',
    component: DefaltOutletComponent,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        component: HomeComponent,
        data: {
          ssr: {
            renderMode: RenderMode.Prerender,
            cache: {
              key: 'home',
              ttl: 60 * 60 * 24 // 24 hours cache
            }
          }
        }
      },
      {
        path: 'books',
        component: BooksComponent
      },
      {
        path: 'books/:id',
        component: BookComponent,
        data: {
          ssr: {
            renderMode: RenderMode.Server,
            cache: {
              key: 'book',
              ttl: 60 * 60
            }
          }
        },
      },
      {
        path: 'user',
        component: OutletUser,
        data: {
          ssr: {
            renderMode: RenderMode.Client,
          }
        },
        loadChildren: () =>
          import('./pages/user/user.routes').then(
            (module_) => module_.routes,
          ),
      }
    ]
  },
  {
    path: 'books/:id/:chapter',
    component: ChaptersComponent,
    data: {
      ssr: {
        renderMode: RenderMode.Server,
        cache: {
          key: 'chapter',
          ttl: 60 * 60
        }
      }
    },
  },
  {
    path: 'auth',
    component: OutletAuht,
    loadChildren: () =>
      import('./pages/auth/auth.routes').then(
        (module_) => module_.routes,
      ),
  },
  {
    path: 'dashboard',
    component: DefaltOutletComponent,
    loadChildren: () =>
      import('./pages/dashboard/dashboard.routes').then(
        (module_) => module_.routes,
      ),
  }
];
