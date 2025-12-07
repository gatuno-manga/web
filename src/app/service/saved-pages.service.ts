import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateSavedPageDto } from '../models/saved-page.models';

import { SavedPage } from '../models/saved-page.models';

@Injectable({
  providedIn: 'root'
})
export class SavedPagesService {
  constructor(private http: HttpClient) {}

  savePage(dto: CreateSavedPageDto) {
    return this.http.post('saved-pages', dto);
  }

  getSavedPages() {
    return this.http.get<SavedPage[]>('saved-pages');
  }

  getSavedPagesByBook(bookId: string) {
    return this.http.get<SavedPage[]>(`saved-pages/book/${bookId}`);
  }

  isPageSaved(pageId: number) {
    return this.http.get<{ pageId: number; isSaved: boolean }>(`saved-pages/check/${pageId}`);
  }

  unsavePage(id: string) {
    return this.http.delete(`saved-pages/${id}`);
  }

  updateComment(id: string, comment: string) {
    return this.http.patch<SavedPage>(`saved-pages/${id}`, { comment });
  }
  
  unsavePageByPageId(pageId: number) {
      return this.http.delete(`saved-pages/page/${pageId}`);
  }
}
