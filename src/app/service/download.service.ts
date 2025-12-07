import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { OfflineBook, OfflineChapter, DownloadProgress } from '../models/offline.models';
import { BehaviorSubject } from 'rxjs';
import { Book, BookBasic, Chapter, Page } from '../models/book.models';
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

    this.updateProgress(chapter.id, { chapterId: chapter.id, total: chapter.pages.length, current: 0, status: 'downloading' });

    try {
      // 1. Ensure Book is saved (fetch cover if needed)
      let savedBook = await this.getBook(book.id);
      if (!savedBook) {
        const coverBlob = await this.fetchImageBlob(book.cover);
        await this.saveBook(book, coverBlob);
      }

      // 2. Download all pages
      let completedCount = 0;

      // Sequential download to avoid overloading network/browser, or parallel with limit?
      // Let's try Promise.all for parallel but formatted for progress updates

      const downloadPromises = chapter.pages.map(async (page: Page, index: number) => {
        const blob = await this.fetchImageBlob(page.path); // Assuming page.path is the URL
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
      // Sort by index just in case
      const sortedBlobs = results.sort((a, b) => a.index - b.index).map(r => r.blob);

      // 3. Save Chapter
      const db = await this.dbPromise;
      const offlineChapter: OfflineChapter = {
        id: chapter.id,
        bookId: book.id,
        title: chapter.title,
        index: chapter.index,
        pages: sortedBlobs,
        downloadedAt: new Date(),
        next: chapter.next,
        previous: chapter.previous
      };
      await db.put('chapters', offlineChapter);

      this.updateProgress(chapter.id, { chapterId: chapter.id, total: chapter.pages.length, current: chapter.pages.length, status: 'completed' });

    } catch (error) {
      console.error('Download failed', error);
      this.updateProgress(chapter.id, { chapterId: chapter.id, total: 0, current: 0, status: 'error' });
      throw error;
    }
  }

  private async fetchImageBlob(url: string): Promise<Blob> {
    return this.http.get(url, { responseType: 'blob' }).toPromise().then(blob => {
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
