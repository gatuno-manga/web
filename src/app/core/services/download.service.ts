import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { environment } from '@environments/environment';
import {
	Book,
	BookBasic,
	Chapter,
	ContentType,
	Page,
} from '@models/book.models';
import {
	DownloadProgress,
	OfflineBook,
	OfflineChapter,
} from '@models/offline.models';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { BehaviorSubject, firstValueFrom, map, Observable } from 'rxjs';

interface GatunoOfflineDB extends DBSchema {
	books: {
		key: string;
		value: OfflineBook;
	};
	chapters: {
		key: string;
		value: OfflineChapter;
		indexes: { 'by-book': string };
	};
}

@Injectable({
	providedIn: 'root',
})
export class DownloadService {
	private dbPromise?: Promise<IDBPDatabase<GatunoOfflineDB>>;
	private progressSubject = new BehaviorSubject<
		Map<string, DownloadProgress>
	>(new Map());
	public downloadProgress$ = this.progressSubject.asObservable();

	constructor(
		private http: HttpClient,
		@Inject(PLATFORM_ID) private platformId: object,
	) {
		if (isPlatformBrowser(this.platformId)) {
			this.dbPromise = openDB<GatunoOfflineDB>('GatunoOfflineDB', 1, {
				upgrade(db) {
					db.createObjectStore('books', { keyPath: 'id' });
					const chapterStore = db.createObjectStore('chapters', {
						keyPath: 'id',
					});
					chapterStore.createIndex('by-book', 'bookId');
				},
			});
		}
	}

	private updateProgress(chapterId: string, progress: DownloadProgress) {
		const currentMap = this.progressSubject.value;
		currentMap.set(chapterId, progress);
		this.progressSubject.next(new Map(currentMap));
	}

	/**
	 * Retorna o progresso agregado de um livro
	 */
	getBookDownloadProgress(bookId: string): Observable<DownloadProgress[]> {
		return this.downloadProgress$.pipe(
			map((progressMap) => {
				return Array.from(progressMap.values()).filter(
					(p) => p.bookId === bookId,
				);
			}),
		);
	}

	async saveBook(
		book: Book | BookBasic,
		coverBlob: Blob,
		lastSyncAt?: Date,
	): Promise<void> {
		if (!this.dbPromise) return;
		const db = await this.dbPromise;

		let totalChapters = 0;
		if ('totalChapters' in book) {
			totalChapters = book.totalChapters;
		} else if ('chapters' in book && Array.isArray(book.chapters)) {
			totalChapters = book.chapters.length;
		}

		const offlineBook: OfflineBook = {
			id: book.id,
			title: book.title,
			cover: coverBlob,
			description: book.description,
			publication: book.publication,
			authors: book.authors,
			tags: book.tags,
			sensitiveContent: book.sensitiveContent,
			totalChapters: totalChapters,
			updatedAt: new Date(),
			lastSyncAt: lastSyncAt,
			blurHash: book.blurHash,
			dominantColor: book.dominantColor,
		};
		await db.put('books', offlineBook);
	}

	async getBook(bookId: string): Promise<OfflineBook | undefined> {
		if (!this.dbPromise) return undefined;
		const db = await this.dbPromise;
		return db.get('books', bookId);
	}

	async getAllBooks(): Promise<OfflineBook[]> {
		if (!this.dbPromise) return [];
		const db = await this.dbPromise;
		return db.getAll('books');
	}

	async getChapter(chapterId: string): Promise<OfflineChapter | undefined> {
		if (!this.dbPromise) return undefined;
		const db = await this.dbPromise;
		return db.get('chapters', chapterId);
	}

	async getChaptersByBook(bookId: string): Promise<OfflineChapter[]> {
		if (!this.dbPromise) return [];
		const db = await this.dbPromise;
		return db.getAllFromIndex('chapters', 'by-book', bookId);
	}

	async isChapterDownloaded(chapterId: string): Promise<boolean> {
		if (!this.dbPromise) return false;
		const chapter = await this.getChapter(chapterId);
		return !!chapter;
	}

	async deleteChapter(chapterId: string): Promise<void> {
		if (!this.dbPromise) return;
		const db = await this.dbPromise;
		await db.delete('chapters', chapterId);
	}

	async deleteBook(bookId: string): Promise<void> {
		if (!this.dbPromise) return;
		const db = await this.dbPromise;

		// Deletar todos os capítulos do livro
		const chapters = await this.getChaptersByBook(bookId);
		for (const chapter of chapters) {
			await db.delete('chapters', chapter.id);
		}

		// Deletar o livro
		await db.delete('books', bookId);

		// Limpar progresso se existir
		const currentMap = this.progressSubject.value;
		let changed = false;
		for (const [key, value] of currentMap.entries()) {
			if (value.bookId === bookId) {
				currentMap.delete(key);
				changed = true;
			}
		}
		if (changed) {
			this.progressSubject.next(new Map(currentMap));
		}
	}

	async isBookDownloaded(bookId: string): Promise<boolean> {
		if (!this.dbPromise) return false;
		const chapters = await this.getChaptersByBook(bookId);
		return chapters.length > 0;
	}

	/**
	 * Sincroniza um livro usando o novo endpoint delta sync
	 */
	async syncBook(book: Book | BookBasic): Promise<void> {
		if (!this.dbPromise) return;

		const savedBook = await this.getBook(book.id);
		const lastSyncAt = savedBook?.lastSyncAt;

		let url = `books/${book.id}/offline-sync`;
		if (lastSyncAt) {
			url += `?updatedSince=${lastSyncAt.toISOString()}`;
		}

		try {
			const syncData = await firstValueFrom(
				this.http.get<{
					chapters: (Chapter & { deleted?: boolean })[];
					syncTimestamp: string;
				}>(url),
			);

			if (!syncData) {
				throw new Error('Sync API returned empty response');
			}

			const chapters = syncData.chapters || [];
			const syncTimestamp = syncData.syncTimestamp
				? new Date(syncData.syncTimestamp)
				: new Date();

			if (!savedBook) {
				let coverBlob: Blob;
				try {
					coverBlob = await this.fetchImageBlob(book.cover);
				} catch (e) {
					console.warn(
						'Failed to download book cover, using placeholder',
						e,
					);
					// Create a simple 1x1 transparent pixel as fallback if cover fails
					coverBlob = new Blob(
						[
							new Uint8Array([
								71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0,
								0, 0, 0, 255, 255, 255, 33, 249, 4, 1, 0, 0, 0,
								0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1,
								0, 59,
							]),
						],
						{ type: 'image/gif' },
					);
				}
				await this.saveBook(book, coverBlob, syncTimestamp);
			}

			if (chapters.length === 0) {
				// Nada para atualizar, apenas atualiza timestamp se necessário
				if (savedBook) {
					await this.saveBook(book, savedBook.cover, syncTimestamp);
				}
				return;
			}

			// Processar capítulos retornados
			for (const chapterData of chapters) {
				try {
					if (chapterData.deleted) {
						await this.deleteChapter(chapterData.id);
						continue;
					}

					// Baixar conteúdo do capítulo (imagens, texto ou documento)
					await this.processAndSaveChapter(book.id, chapterData);
				} catch (chapterError) {
					console.error(
						`Failed to sync chapter ${chapterData.id}`,
						chapterError,
					);
					// Continue with next chapter
				}
			}

			// Atualizar timestamp da última sincronização
			const currentSavedBook = await this.getBook(book.id);
			if (currentSavedBook) {
				await this.saveBook(
					book,
					currentSavedBook.cover,
					syncTimestamp,
				);
			}
		} catch (error) {
			console.error('Offline sync failed', error);
			throw error;
		}
	}

	private async processAndSaveChapter(
		bookId: string,
		chapter: Chapter,
	): Promise<void> {
		const contentType: ContentType = chapter.contentType || 'image';
		const pages = chapter.pages || [];

		try {
			this.updateProgress(chapter.id, {
				chapterId: chapter.id,
				bookId: bookId,
				total: contentType === 'image' ? pages.length : 1,
				current: 0,
				status: 'downloading',
			});

			const db = await this.dbPromise;
			if (!db) return;

			let offlineChapter: OfflineChapter;

			if (contentType === 'text') {
				offlineChapter = {
					id: chapter.id,
					bookId: bookId,
					title: chapter.title,
					index: chapter.index,
					contentType: 'text',
					pages: [],
					content: chapter.content,
					contentFormat: chapter.contentFormat,
					downloadedAt: new Date(),
					next: chapter.next,
					previous: chapter.previous,
				};
			} else if (contentType === 'document' && chapter.documentPath) {
				const url = this.resolveAssetUrl(chapter.documentPath);
				const documentBlob = await firstValueFrom(
					this.http.get(url, { responseType: 'blob' }),
				);
				offlineChapter = {
					id: chapter.id,
					bookId: bookId,
					title: chapter.title,
					index: chapter.index,
					contentType: 'document',
					pages: [],
					document: documentBlob,
					documentFormat: chapter.documentFormat,
					downloadedAt: new Date(),
					next: chapter.next,
					previous: chapter.previous,
				};
			} else {
				// Default: IMAGE
				let completedCount = 0;
				const downloadPromises = pages.map(
					async (page: Page, index: number) => {
						try {
							const blob = await this.fetchImageBlob(page.path);
							completedCount++;
							this.updateProgress(chapter.id, {
								chapterId: chapter.id,
								bookId: bookId,
								total: pages.length,
								current: completedCount,
								status: 'downloading',
							});
							return { index, blob };
						} catch (e) {
							console.warn(
								`Failed to download page ${page.path}`,
								e,
							);
							completedCount++; // Increment anyway to keep progress moving
							return { index, blob: null as unknown as Blob }; // Will handle nulls below if needed
						}
					},
				);

				const results = await Promise.all(downloadPromises);
				const sortedBlobs = results
					.sort((a, b) => a.index - b.index)
					.filter((r) => r.blob !== null) // Filter out failed pages
					.map((r) => r.blob);

				if (sortedBlobs.length === 0 && pages.length > 0) {
					throw new Error('All pages failed to download');
				}

				offlineChapter = {
					id: chapter.id,
					bookId: bookId,
					title: chapter.title,
					index: chapter.index,
					contentType: 'image',
					pages: sortedBlobs,
					downloadedAt: new Date(),
					next: chapter.next,
					previous: chapter.previous,
				};
			}

			await db.put('chapters', offlineChapter);

			this.updateProgress(chapter.id, {
				chapterId: chapter.id,
				bookId: bookId,
				total: contentType === 'image' ? pages.length : 1,
				current: contentType === 'image' ? pages.length : 1,
				status: 'completed',
			});
		} catch (error) {
			console.error(`Failed to process chapter ${chapter.id}`, error);
			this.updateProgress(chapter.id, {
				chapterId: chapter.id,
				bookId: bookId,
				total: 0,
				current: 0,
				status: 'error',
			});
			throw error;
		}
	}

	/**
	 * @deprecated Use syncBook instead
	 */
	async downloadChapter(
		book: Book | BookBasic,
		chapter: Chapter,
	): Promise<void> {
		if (!this.dbPromise) return;
		if (await this.isChapterDownloaded(chapter.id)) return;

		const contentType: ContentType = chapter.contentType || 'image';

		try {
			// 1. Ensure Book is saved (fetch cover if needed)
			const savedBook = await this.getBook(book.id);
			if (!savedBook) {
				const coverBlob = await this.fetchImageBlob(book.cover);
				await this.saveBook(book, coverBlob);
			}

			// 2. Download based on content type
			switch (contentType) {
				case 'text':
					await this.downloadTextChapter(book, chapter);
					break;
				case 'document':
					await this.downloadDocumentChapter(book, chapter);
					break;
				default:
					await this.downloadImageChapter(book, chapter);
					break;
			}
		} catch (error) {
			console.error('Download failed', error);
			this.updateProgress(chapter.id, {
				chapterId: chapter.id,
				bookId: book.id,
				total: 0,
				current: 0,
				status: 'error',
			});
			throw error;
		}
	}

	private async downloadImageChapter(
		book: Book | BookBasic,
		chapter: Chapter,
	): Promise<void> {
		if (!this.dbPromise) return;

		this.updateProgress(chapter.id, {
			chapterId: chapter.id,
			bookId: book.id,
			total: chapter.pages.length,
			current: 0,
			status: 'downloading',
		});

		let completedCount = 0;
		const downloadPromises = chapter.pages.map(
			async (page: Page, index: number) => {
				try {
					const blob = await this.fetchImageBlob(page.path);
					completedCount++;
					this.updateProgress(chapter.id, {
						chapterId: chapter.id,
						bookId: book.id,
						total: chapter.pages.length,
						current: completedCount,
						status: 'downloading',
					});
					return { index, blob };
				} catch (e) {
					console.warn(`Failed to download page ${page.path}`, e);
					completedCount++;
					return { index, blob: null };
				}
			},
		);

		const results = await Promise.all(downloadPromises);
		const sortedBlobs = results
			.sort((a, b) => a.index - b.index)
			.filter((r) => r.blob !== null)
			.map((r) => r.blob as Blob);

		if (sortedBlobs.length === 0 && chapter.pages.length > 0) {
			throw new Error('All pages failed to download');
		}

		const db = await this.dbPromise;
		const offlineChapter: OfflineChapter = {
			id: chapter.id,
			bookId: book.id,
			title: chapter.title,
			index: chapter.index,
			contentType: 'image',
			pages: sortedBlobs,
			downloadedAt: new Date(),
			next: chapter.next,
			previous: chapter.previous,
		};
		await db.put('chapters', offlineChapter);

		this.updateProgress(chapter.id, {
			chapterId: chapter.id,
			bookId: book.id,
			total: chapter.pages.length,
			current: chapter.pages.length,
			status: 'completed',
		});
	}

	private async downloadTextChapter(
		book: Book | BookBasic,
		chapter: Chapter,
	): Promise<void> {
		if (!this.dbPromise) return;

		// TEXT content is already inline in chapter.content - no network fetch needed
		this.updateProgress(chapter.id, {
			chapterId: chapter.id,
			bookId: book.id,
			total: 1,
			current: 0,
			status: 'downloading',
		});

		const db = await this.dbPromise;
		const offlineChapter: OfflineChapter = {
			id: chapter.id,
			bookId: book.id,
			title: chapter.title,
			index: chapter.index,
			contentType: 'text',
			pages: [], // No image pages
			content: chapter.content,
			contentFormat: chapter.contentFormat,
			downloadedAt: new Date(),
			next: chapter.next,
			previous: chapter.previous,
		};
		await db.put('chapters', offlineChapter);

		this.updateProgress(chapter.id, {
			chapterId: chapter.id,
			bookId: book.id,
			total: 1,
			current: 1,
			status: 'completed',
		});
	}

	private async downloadDocumentChapter(
		book: Book | BookBasic,
		chapter: Chapter,
	): Promise<void> {
		if (!this.dbPromise || !chapter.documentPath) return;

		this.updateProgress(chapter.id, {
			chapterId: chapter.id,
			bookId: book.id,
			total: 1,
			current: 0,
			status: 'downloading',
		});

		// Fetch the document blob
		const url = this.resolveAssetUrl(chapter.documentPath);
		const documentBlob = await firstValueFrom(
			this.http.get(url, { responseType: 'blob' }),
		);
		if (!documentBlob) throw new Error('Failed to download document');

		const db = await this.dbPromise;
		const offlineChapter: OfflineChapter = {
			id: chapter.id,
			bookId: book.id,
			title: chapter.title,
			index: chapter.index,
			contentType: 'document',
			pages: [], // No image pages
			document: documentBlob,
			documentFormat: chapter.documentFormat,
			downloadedAt: new Date(),
			next: chapter.next,
			previous: chapter.previous,
		};
		await db.put('chapters', offlineChapter);

		this.updateProgress(chapter.id, {
			chapterId: chapter.id,
			bookId: book.id,
			total: 1,
			current: 1,
			status: 'completed',
		});
	}

	private resolveAssetUrl(path: string): string {
		if (!path) return '';
		// Already absolute URL - return as-is
		if (path.startsWith('http://') || path.startsWith('https://'))
			return path;
		// Relative URL: resolve against API base URL
		const base = (environment.apiURL || '')
			.replace(/\/api\/?$/, '')
			.replace(/\/+$/, '');
		const cleanPath = path.replace(/^\/+/, '');
		return `${base}/${cleanPath}`;
	}

	/**
	 * Converts an absolute API URL to a relative path so the Angular dev server
	 * proxy can follow any cross-origin redirects (e.g. to MinIO) server-side,
	 * preventing CORS errors in the browser.
	 */
	private toProxyRelativeUrl(url: string): string {
		if (!isPlatformBrowser(this.platformId)) return url;
		try {
			const apiOrigin = new URL(
				environment.apiURL || window.location.origin,
			).origin;
			const parsed = new URL(url);
			if (parsed.origin === apiOrigin) {
				// Return just the path+query so the request goes through the
				// Angular dev-server proxy (e.g. /api/data/books/...)
				return parsed.pathname + parsed.search;
			}
		} catch {
			// fall through
		}
		return url;
	}

	private isExternalUrl(url: string): boolean {
		if (!url.startsWith('http://') && !url.startsWith('https://'))
			return false;
		try {
			const apiOrigin = new URL(
				environment.apiURL || window.location.origin,
			).origin;
			const urlOrigin = new URL(url).origin;
			return urlOrigin !== apiOrigin;
		} catch {
			return false;
		}
	}

	private async fetchImageBlob(url: string): Promise<Blob> {
		const resolvedUrl = this.resolveAssetUrl(url);

		// For genuinely external URLs (e.g. a public CDN on a different domain)
		// use native fetch without any custom headers that could trigger CORS preflight.
		if (this.isExternalUrl(resolvedUrl)) {
			const response = await fetch(resolvedUrl);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch image: ${response.status} ${response.statusText}`,
				);
			}
			return response.blob();
		}

		// For internal API URLs that may redirect to MinIO/S3, use a relative URL
		// so the Angular dev-server proxy follows the redirect server-side.
		// This avoids the browser making a cross-origin request to the storage server.
		const proxyUrl = this.toProxyRelativeUrl(resolvedUrl);
		return firstValueFrom(
			this.http.get(proxyUrl, { responseType: 'blob' }),
		);
	}

	saveToDevice(url: string, filename: string) {
		const resolvedUrl = this.resolveAssetUrl(url);
		const triggerDownload = (blob: Blob) => {
			const a = document.createElement('a');
			const objectUrl = URL.createObjectURL(blob);
			a.href = objectUrl;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(objectUrl);
		};

		if (this.isExternalUrl(resolvedUrl)) {
			// Use native fetch for external URLs to avoid CORS from Angular interceptor headers
			fetch(resolvedUrl)
				.then((response) => {
					if (!response.ok)
						throw new Error(`HTTP ${response.status}`);
					return response.blob();
				})
				.then(triggerDownload)
				.catch((err) =>
					console.error('Failed to save image to device', err),
				);
			return;
		}

		// Use a proxy-relative URL so the dev server follows any storage redirects server-side
		const proxyUrl = this.toProxyRelativeUrl(resolvedUrl);
		this.http.get(proxyUrl, { responseType: 'blob' }).subscribe((blob) => {
			triggerDownload(blob);
		});
	}
}
