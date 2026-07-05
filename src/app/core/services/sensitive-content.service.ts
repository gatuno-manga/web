import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { SensitiveContentResponse } from '@models/book.models';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CookieService } from './cookie.service';

@Injectable({
	providedIn: 'root',
})
export class SensitiveContentService {
	private readonly http = inject(HttpClient);
	private readonly cookieService = inject(CookieService);

	KEY = 'sensitive-content-allow';

	allowContentSignal = signal<string[]>(this.getInitialContentAllow());

	/** Cached observable — shared across all subscribers to avoid duplicate GETs. */
	private sensitiveContentCache$: Observable<SensitiveContentResponse[]> | null =
		null;

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

	/**
	 * Returns the list of sensitive-content types.
	 * The first call triggers a single GET request; subsequent calls (e.g. from the
	 * user-menu and book-filter rendered on the same page) share the cached response
	 * via shareReplay(1) — no duplicate network requests are made.
	 * The cache is invalidated whenever the data is mutated (create/update/delete/merge).
	 */
	getSensitiveContent(): Observable<SensitiveContentResponse[]> {
		if (!this.sensitiveContentCache$) {
			this.sensitiveContentCache$ = this.http
				.get<SensitiveContentResponse[]>('sensitive-content')
				.pipe(
					catchError(() => of([])),
					shareReplay(1),
				);
		}
		return this.sensitiveContentCache$;
	}

	/** Invalidates the in-memory cache so the next call triggers a fresh GET. */
	private invalidateCache(): void {
		this.sensitiveContentCache$ = null;
	}

	/**
	 * Cria uma nova tag de conteúdo sensível.
	 */
	createSensitiveContent(name: string): Observable<SensitiveContentResponse> {
		return this.http
			.post<SensitiveContentResponse>('sensitive-content', { name })
			.pipe(tap(() => this.invalidateCache()));
	}

	/**
	 * Atualiza uma tag de conteúdo sensível existente.
	 */
	updateSensitiveContent(
		id: string,
		name: string,
	): Observable<SensitiveContentResponse> {
		return this.http
			.put<SensitiveContentResponse>(`sensitive-content/${id}`, { name })
			.pipe(tap(() => this.invalidateCache()));
	}

	/**
	 * Remove uma tag de conteúdo sensível.
	 */
	deleteSensitiveContent(id: string): Observable<void> {
		return this.http
			.delete<void>(`sensitive-content/${id}`)
			.pipe(tap(() => this.invalidateCache()));
	}

	/**
	 * Mescla tags de conteúdo sensível.
	 */
	mergeSensitiveContent(
		contentId: string,
		targetId: string,
	): Observable<void> {
		return this.http
			.patch<void>(`sensitive-content/${contentId}/merge`, { targetId })
			.pipe(tap(() => this.invalidateCache()));
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
