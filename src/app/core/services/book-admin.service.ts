import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Book, Chapterlist } from '@models/book.models';
import {
	BookVerificationResult,
	ChapterReorderItem,
	CreateBookDto,
	DeletedBookItem,
	OfflineSyncData,
} from '@models/book-admin.models';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class BookAdminService {
	private readonly http = inject(HttpClient);

	/**
	 * Cria um novo livro manualmente.
	 */
	createBook(data: CreateBookDto): Observable<Book> {
		return this.http.post<Book>('books', data);
	}

	/**
	 * Tenta criar um livro automaticamente a partir de metadados externos.
	 */
	autoCreateBook(data: { url: string }): Observable<Book> {
		return this.http.post<Book>('books/auto-create', data);
	}

	/**
	 * Realiza o soft delete de um livro.
	 */
	deleteBook(id: string): Observable<void> {
		return this.http.delete<void>(`books/${id}`);
	}

	/**
	 * Verifica a integridade de um livro.
	 */
	verifyBook(id: string): Observable<BookVerificationResult> {
		return this.http.get<BookVerificationResult>(`books/${id}/verify`);
	}

	/**
	 * Reordena os capítulos de um livro.
	 */
	reorderChapters(
		bookId: string,
		order: ChapterReorderItem[],
	): Observable<void> {
		return this.http.patch<void>(`books/${bookId}/chapters/order`, order);
	}

	/**
	 * Atualiza múltiplos capítulos em lote.
	 */
	updateChapters(bookId: string, chapters: Chapterlist[]): Observable<void> {
		return this.http.patch<void>(`books/${bookId}/chapters`, chapters);
	}

	/**
	 * Cria capítulos em lote.
	 */
	createChaptersBatch(data: {
		bookId: string;
		chapters: Partial<Chapterlist>[];
	}): Observable<void> {
		return this.http.post<void>(
			`books/${data.bookId}/batch/chapters`,
			data,
		);
	}

	/**
	 * Remove múltiplos capítulos em lote.
	 */
	deleteChaptersBatch(chapterIds: string[]): Observable<void> {
		return this.http.delete<void>('books/batch/chapters', {
			body: chapterIds,
		});
	}

	/**
	 * Remove múltiplos livros em lote.
	 */
	deleteBooksBatch(bookIds: string[]): Observable<void> {
		return this.http.delete<void>('books/batch/books', { body: bookIds });
	}

	/**
	 * Lista livros deletados (soft delete).
	 */
	getDeletedBooks(): Observable<DeletedBookItem[]> {
		return this.http.get<DeletedBookItem[]>('books/deleted/books');
	}

	/**
	 * Sincronização offline de capítulos do servidor.
	 */
	getOfflineSync(bookId: string): Observable<OfflineSyncData> {
		return this.http.get<OfflineSyncData>(`books/${bookId}/offline-sync`);
	}
}
