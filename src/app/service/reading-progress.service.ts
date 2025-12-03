import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ReadingProgress {
  chapterId: string;
  bookId: string;
  pageIndex: number;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ReadingProgressService {
  private dbName = 'gatuno_db';
  private storeName = 'reading_progress';
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.dbPromise = this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!this.isBrowser) {
          return reject('Not in browser');
      }
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = (event) => {
        console.error('Erro ao abrir IndexedDB:', event);
        reject(event);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'chapterId' });
        }
      };
    });
  }

  async saveProgress(chapterId: string, bookId: string, pageIndex: number): Promise<void> {
    if (!this.isBrowser || !this.dbPromise) return;
    
    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const progress: ReadingProgress = {
          chapterId,
          bookId,
          pageIndex,
          updatedAt: new Date()
        };

        const request = store.put(progress);

        request.onsuccess = () => {
          console.log(`✅ Progresso de leitura salvo para capítulo ${chapterId}, página ${pageIndex}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao salvar progresso de leitura:', error);
    }
  }

  async getProgress(chapterId: string): Promise<ReadingProgress | undefined> {
    if (!this.isBrowser || !this.dbPromise) return undefined;

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(chapterId);

        request.onsuccess = () => {
          resolve(request.result as ReadingProgress);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao recuperar progresso de leitura:', error);
      return undefined;
    }
  }

  async deleteProgress(chapterId: string): Promise<void> {
    if (!this.isBrowser || !this.dbPromise) return;

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(chapterId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao deletar progresso:', error);
    }
  }
}
