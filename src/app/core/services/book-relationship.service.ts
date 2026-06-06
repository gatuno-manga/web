import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
	BookRelationshipQueryOptions,
	BookRelationshipsPage,
	CreateBookRelationshipDto,
	UpdateBookRelationshipDto,
} from '@models/book-relationship.models';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class BookRelationshipService {
	private readonly http = inject(HttpClient);

	/**
	 * Retorna os relacionamentos de um livro.
	 * @param bookId ID do livro principal.
	 * @param options Opções de filtro e paginação.
	 */
	getBookRelationships(
		bookId: string,
		options?: BookRelationshipQueryOptions,
	): Observable<BookRelationshipsPage> {
		return this.http.get<BookRelationshipsPage>(
			`books/${bookId}/relationships`,
			{
				params: { ...options },
			},
		);
	}

	/**
	 * Cria um novo relacionamento entre o livro de origem e o destino.
	 * Requer privilégios administrativos.
	 */
	createRelationship(
		sourceBookId: string,
		data: CreateBookRelationshipDto,
	): Observable<void> {
		return this.http.post<void>(
			`books/${sourceBookId}/relationships`,
			data,
		);
	}

	/**
	 * Atualiza os dados de um relacionamento existente.
	 * Requer privilégios administrativos.
	 */
	updateRelationship(
		sourceBookId: string,
		relationshipId: string,
		data: UpdateBookRelationshipDto,
	): Observable<void> {
		return this.http.patch<void>(
			`books/${sourceBookId}/relationships/${relationshipId}`,
			data,
		);
	}

	/**
	 * Remove um relacionamento entre livros (soft delete).
	 * Requer privilégios administrativos.
	 */
	deleteRelationship(
		sourceBookId: string,
		relationshipId: string,
	): Observable<void> {
		return this.http.delete<void>(
			`books/${sourceBookId}/relationships/${relationshipId}`,
		);
	}

	/**
	 * Retorna o label legível para um tipo de relacionamento entre livros.
	 */
	getRelationTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			sequence: 'Sequência',
			'spin-off': 'Spin-off',
			doujinshi: 'Doujinshi',
			'same-franchise': 'Mesma Franquia',
			related: 'Relacionado',
			adaptation: 'Adaptação',
			crossover: 'Crossover',
		};
		return labels[type] || type;
	}
}
