import { Injectable, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class SearchService {
	query = signal<string>('');

	setQuery(val: string) {
		this.query.set(val);
	}
}
