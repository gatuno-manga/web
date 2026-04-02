import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateSavedPageDto } from '../models/saved-page.models';
import { map } from 'rxjs/operators';

import { SavedPage } from '../models/saved-page.models';

@Injectable({
	providedIn: 'root',
})
export class SavedPagesService {
	private readonly baseUrl = 'users/me/saved-pages';
	constructor(private http: HttpClient) {}

	savePage(dto: CreateSavedPageDto) {
		return this.http
			.post<{ data: SavedPage }>(this.baseUrl, dto)
			.pipe(map((res) => res.data));
	}

	getSavedPages() {
		return this.http
			.get<{ data: SavedPage[] }>(this.baseUrl)
			.pipe(map((res) => res.data));
	}

	getSavedPagesByBook(bookId: string) {
		return this.http
			.get<{ data: SavedPage[] }>(`${this.baseUrl}/book/${bookId}`)
			.pipe(map((res) => res.data));
	}

	isPageSaved(pageId: number) {
		return this.http
			.get<{ data: { pageId: number; isSaved: boolean } }>(
				`${this.baseUrl}/check/${pageId}`,
			)
			.pipe(map((res) => res.data));
	}

	unsavePage(id: string) {
		return this.http.delete(`${this.baseUrl}/${id}`);
	}

	updateComment(id: string, comment: string) {
		return this.http
			.patch<{ data: SavedPage }>(`${this.baseUrl}/${id}`, { comment })
			.pipe(map((res) => res.data));
	}

	unsavePageByPageId(pageId: number) {
		return this.http.delete(`${this.baseUrl}/page/${pageId}`);
	}
}
