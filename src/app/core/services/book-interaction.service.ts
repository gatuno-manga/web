import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ReviewBookDto } from '@models/book-interaction.models';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class BookInteractionService {
	private readonly http = inject(HttpClient);

	/**
	 * Marca um livro como favorito para o usuário logado.
	 */
	favorite(bookId: string): Observable<void> {
		return this.http.post<void>(`books/${bookId}/favorite`, {});
	}

	/**
	 * Se inscreve para receber atualizações de um livro.
	 */
	subscribe(bookId: string): Observable<void> {
		return this.http.post<void>(`books/${bookId}/subscribe`, {});
	}

	/**
	 * Envia uma avaliação e comentário para um livro.
	 */
	review(bookId: string, data: ReviewBookDto): Observable<void> {
		return this.http.post<void>(`books/${bookId}/reviews`, data);
	}
}
