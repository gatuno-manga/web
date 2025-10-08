import { Component, signal } from '@angular/core';
import { LocalStorageService } from '../../service/local-storage.service';
import { BookService } from '../../service/book.service';
import { BookList, BookPageOptions } from '../../models/book.models';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ItemBookComponent } from '../../components/item-book/item-book.component';
import { Page } from '../../models/miscellaneous.models';
import { SelectComponent } from '../../components/select/select.component';

@Component({
  selector: 'app-books',
  imports: [RouterModule, ItemBookComponent, SelectComponent],
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss'
})
export class BooksComponent {
  books: BookList[] = [];
  currentPage = 1;
  lastPage = 1;
  pagesToShow: number[] = [];
  isLoading = signal(true);
  bookOptions: 'grid' | 'list' = 'grid';
  filterOptions: BookPageOptions = {};
  selectList = [
    {
      icon: 'grid',
      checked: () => this.setBookOptions('grid'),
    },
    {
      icon: 'list',
      checked: () => this.setBookOptions('list'),
    }
  ];

  constructor(
    private booksService: BookService,
    private localStorage: LocalStorageService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    const savedLayout = this.localStorage.get('books-layout');
    if (savedLayout === 'grid' || savedLayout === 'list') {
      this.bookOptions = savedLayout;
    }

    this.route.queryParams.subscribe(params => {
      const pageFromUrl = params['page'] ? parseInt(params['page'], 10) : 1;
      this.currentPage = pageFromUrl > 0 ? pageFromUrl : 1;

      const filters: BookPageOptions = {
        page: this.currentPage,
      };

      if (params['search']) filters.search = params['search'];
      if (params['type']) filters.type = Array.isArray(params['type']) ? params['type'] : [params['type']];
      if (params['tags']) filters.tags = Array.isArray(params['tags']) ? params['tags'] : [params['tags']];
      if (params['tagsLogic']) filters.tagsLogic = params['tagsLogic'] as 'and' | 'or';
      if (params['excludeTags']) filters.excludeTags = Array.isArray(params['excludeTags']) ? params['excludeTags'] : [params['excludeTags']];
      if (params['excludeTagsLogic']) filters.excludeTagsLogic = params['excludeTagsLogic'] as 'and' | 'or';
      if (params['authors']) filters.authors = Array.isArray(params['authors']) ? params['authors'] : [params['authors']];
      if (params['authorsLogic']) filters.authorsLogic = params['authorsLogic'] as 'and' | 'or';
      if (params['publication']) filters.publication = parseInt(params['publication'], 10);
      if (params['publicationOperator']) filters.publicationOperator = params['publicationOperator'] as 'eq' | 'gt' | 'lt' | 'gte' | 'lte';
      if (params['orderBy']) filters.orderBy = params['orderBy'] as 'title' | 'createdAt' | 'updatedAt' | 'publication';
      if (params['order']) filters.order = params['order'] as 'ASC' | 'DESC';
      if (params['sensitiveContent']) filters.sensitiveContent = Array.isArray(params['sensitiveContent']) ? params['sensitiveContent'] : [params['sensitiveContent']];

      this.filterOptions = filters;
      this.loadBooks();
    });
  }

  setBookOptions(option: 'grid' | 'list') {
    this.bookOptions = option;
    this.localStorage.set('books-layout', option);
  }

  loadBooks() {
    this.booksService.getBooks(this.filterOptions).subscribe((bookPage: Page<BookList>) => {
      this.books = bookPage.data;
      this.currentPage = bookPage.metadata.page;
      this.lastPage = bookPage.metadata.lastPage;
      this.pagesToShow = this.getPagesToShow();
      this.isLoading.set(false);
    });
  }

  getPagesToShow(): number[] {
    const pages = new Set<number>();
    pages.add(1);
    pages.add(this.lastPage);

    for (let i = this.currentPage - 2; i <= this.currentPage + 2; i++) {
      if (i > 1 && i < this.lastPage) {
        pages.add(i);
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  goToPage(page: number) {
    if (page !== this.currentPage && page >= 1 && page <= this.lastPage) {
      const cleanParams = Object.fromEntries(
        Object.entries({ ...this.filterOptions, page }).filter(([_, value]) => value !== undefined)
      );

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: cleanParams
      });
    }
  }

  selectListItem(): number {
    return this.selectList.findIndex(item => item.icon === this.bookOptions);
  }
}
