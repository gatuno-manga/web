import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BookReview, ReviewBookDto } from '@models/book-interaction.models';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class BookInteractionService {

	private readonly http = inject(HttpClient);

	/**
	 * Busca os livros favoritos do usuario.
	 */
	getFavorites(limit = 20): Observable<any> {
		return this.http.get<any>(`interactions/favorites?limit=${limit}`);
	}

	/**
	 * Busca as avaliações de um livro.
	 */
	getReviews(bookId: string): Observable<BookReview[]> {
		return this.http.get<BookReview[]>(`books/${bookId}/reviews`);
	}

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
