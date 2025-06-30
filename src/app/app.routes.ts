import { Routes } from '@angular/router';
import { RenderMode, ServerRoute } from '@angular/ssr';
import { DefaltOutletComponent } from './pages/outlet/defalt-outlet/defalt-outlet.component';
import { BookComponent } from './pages/book/book.component';
import { BooksComponent } from './pages/books/books.component';
import { ChaptersComponent } from './pages/chapters/chapters.component';
import { HomeComponent } from './pages/home/home.component';

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
        component: HomeComponent
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
  }
];
