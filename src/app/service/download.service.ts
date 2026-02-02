import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { OfflineBook, OfflineChapter, DownloadProgress } from '../models/offline.models';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Book, BookBasic, Chapter, Page, ContentType } from '../models/book.models';
import { HttpClient } from '@angular/common/http';

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
  providedIn: 'root'
})
export class DownloadService {
  private dbPromise?: Promise<IDBPDatabase<GatunoOfflineDB>>;
  private progressSubject = new BehaviorSubject<Map<string, DownloadProgress>>(new Map());
  public downloadProgress$ = this.progressSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.dbPromise = openDB<GatunoOfflineDB>('GatunoOfflineDB', 1, {
        upgrade(db) {
          db.createObjectStore('books', { keyPath: 'id' });
          const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' });
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

  async saveBook(book: Book | BookBasic, coverBlob: Blob): Promise<void> {
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
      updatedAt: new Date()
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
  }

  async isBookDownloaded(bookId: string): Promise<boolean> {
    if (!this.dbPromise) return false;
    const chapters = await this.getChaptersByBook(bookId);
    return chapters.length > 0;
  }

  async downloadChapter(book: Book | BookBasic, chapter: Chapter): Promise<void> {
    if (!this.dbPromise) return;
    if (await this.isChapterDownloaded(chapter.id)) return;

    const contentType: ContentType = chapter.contentType || 'image';

    try {
      // 1. Ensure Book is saved (fetch cover if needed)
      let savedBook = await this.getBook(book.id);
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
      this.updateProgress(chapter.id, { chapterId: chapter.id, total: 0, current: 0, status: 'error' });
      throw error;
    }
  }

  private async downloadImageChapter(book: Book | BookBasic, chapter: Chapter): Promise<void> {
    if (!this.dbPromise) return;

    this.updateProgress(chapter.id, { chapterId: chapter.id, total: chapter.pages.length, current: 0, status: 'downloading' });

    let completedCount = 0;
    const downloadPromises = chapter.pages.map(async (page: Page, index: number) => {
      const blob = await this.fetchImageBlob(page.path);
      completedCount++;
      this.updateProgress(chapter.id, {
        chapterId: chapter.id,
        total: chapter.pages.length,
        current: completedCount,
        status: 'downloading'
      });
      return { index, blob };
    });

    const results = await Promise.all(downloadPromises);
    const sortedBlobs = results.sort((a, b) => a.index - b.index).map(r => r.blob);

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
      previous: chapter.previous
    };
    await db.put('chapters', offlineChapter);

    this.updateProgress(chapter.id, { chapterId: chapter.id, total: chapter.pages.length, current: chapter.pages.length, status: 'completed' });
  }

  private async downloadTextChapter(book: Book | BookBasic, chapter: Chapter): Promise<void> {
    if (!this.dbPromise) return;

    // TEXT content is already inline in chapter.content - no network fetch needed
    this.updateProgress(chapter.id, { chapterId: chapter.id, total: 1, current: 0, status: 'downloading' });

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
      previous: chapter.previous
    };
    await db.put('chapters', offlineChapter);

    this.updateProgress(chapter.id, { chapterId: chapter.id, total: 1, current: 1, status: 'completed' });
  }

  private async downloadDocumentChapter(book: Book | BookBasic, chapter: Chapter): Promise<void> {
    if (!this.dbPromise || !chapter.documentPath) return;

    this.updateProgress(chapter.id, { chapterId: chapter.id, total: 1, current: 0, status: 'downloading' });

    // Fetch the document blob
    const documentBlob = await firstValueFrom(this.http.get(chapter.documentPath, { responseType: 'blob' }));
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
      previous: chapter.previous
    };
    await db.put('chapters', offlineChapter);

    this.updateProgress(chapter.id, { chapterId: chapter.id, total: 1, current: 1, status: 'completed' });
  }

  private async fetchImageBlob(url: string): Promise<Blob> {
    return firstValueFrom(this.http.get(url, { responseType: 'blob' })).then(blob => {
      if (!blob) throw new Error('Empty blob received');
      return blob;
    });
  }

  saveToDevice(url: string, filename: string) {
    this.http.get(url, { responseType: 'blob' }).subscribe(blob => {
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
    });
  }
}
