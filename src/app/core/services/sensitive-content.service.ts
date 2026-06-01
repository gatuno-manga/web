import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Injectable, inject, signal } from '@angular/core';
import { SensitiveContentResponse } from '@models/book.models';
import { CookieService } from './cookie.service';

@Injectable({
	providedIn: 'root',
})
export class SensitiveContentService {
	private readonly http = inject(HttpClient);
	private readonly cookieService = inject(CookieService);

	KEY = 'sensitive-content-allow';

	allowContentSignal = signal<string[]>(this.getInitialContentAllow());

	private getInitialContentAllow(): string[] {
		const content = this.cookieService.get(this.KEY);
		if (!content) return [];
		try {
			return JSON.parse(content) as string[];
		} catch (error) {
			console.error('Error parsing content allow:', error);
			return [];
		}
	}

	getContentAllow(): string[] {
		return this.allowContentSignal();
	}

	setContentAllow(content: string[]): void {
		this.cookieService.set(this.KEY, JSON.stringify(content));
		this.allowContentSignal.set(content);
	}

	getSensitiveContent() {
		return this.http.get<SensitiveContentResponse[]>('sensitive-content').pipe(
			catchError(() => of([]))
		);
	}

	isAllowed(contents: { name: string }[] | string[]): boolean {
		const allowed = new Set(this.allowContentSignal());
		// Default 'safe' content is always allowed
		allowed.add('safe');

		if (!contents || contents.length === 0) return true;

		return contents.every((c) => {
			const name = typeof c === 'string' ? c : c.name;
			return allowed.has(name);
		});
	}
}
