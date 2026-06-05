import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
	AddBookToCollectionDto,
	Collection,
	CreateCollectionDto,
	ShareCollectionDto,
} from '@models/collection.models';
import { Observable, tap, map } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class CollectionService {
	private readonly http = inject(HttpClient);

	// Estado local para as coleções do usuário logado
	private readonly myCollectionsSignal = signal<Collection[]>([]);
	readonly myCollections = this.myCollectionsSignal.asReadonly();

	/**
	 * Busca as coleções do usuário atual e atualiza o sinal de estado.
	 */
	getMyCollections(): Observable<Collection[]> {
		return this.http.get<any>('collections').pipe(
			map((response: any) => {
				if (Array.isArray(response)) return response;
				return response?.data || [];
			}),
			tap((collections) => {
				this.myCollectionsSignal.set(collections);
			}),
		);
	}

	/**
	 * Cria uma nova coleção.
	 */
	createCollection(data: CreateCollectionDto): Observable<Collection> {
		return this.http.post<Collection>('collections', data).pipe(
			tap((newCollection) => {
				this.myCollectionsSignal.update((current) => {
					const arr = Array.isArray(current) ? current : [];
					return [newCollection, ...arr];
				});
			}),
		);
	}

	/**
	 * Adiciona um livro a uma coleção existente.
	 */
	addBookToCollection(
		collectionId: string,
		data: AddBookToCollectionDto,
	): Observable<void> {
		return this.http.post<void>(`collections/${collectionId}/books`, data);
	}

	/**
	 * Compartilha uma coleção com outro usuário (colaborador).
	 */
	shareCollection(
		collectionId: string,
		data: ShareCollectionDto,
	): Observable<void> {
		return this.http.post<void>(`collections/${collectionId}/share`, data);
	}

	/**
	 * Busca as coleções públicas de um usuário específico.
	 */
	getPublicCollections(userId: string): Observable<Collection[]> {
		return this.http.get<Collection[]>(
			`users/${userId}/public/collections`,
		);
	}
}
