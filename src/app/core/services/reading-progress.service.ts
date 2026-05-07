import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ReadingProgress {
  id: string; // Chave composta: `${userId}_${chapterId}`
  chapterId: string;
  bookId: string;
  userId: string; // 'guest' para usuários não logados
  pageIndex: number;
  updatedAt: Date;
}

export interface SyncQueueItem {
  chapterId: string;
  bookId: string;
  pageIndex: number;
  timestamp: number;
  totalPages?: number;
  completed?: boolean;
  accessToken: string;
}

const GUEST_USER_ID = 'guest';

@Injectable({
  providedIn: 'root'
})
export class ReadingProgressService {
  private dbName = 'gatuno_db';
  private storeName = 'reading_progress';
  private syncStoreName = 'sync_queue';
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isBrowser: boolean;
  private currentUserId: string = GUEST_USER_ID;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.dbPromise = this.initDB();
    }
  }

  /**
   * Define o usuário atual para o serviço
   * Usado quando o usuário faz login/logout
   */
  setCurrentUser(userId: string | null): void {
    this.currentUserId = userId || GUEST_USER_ID;
    console.log(`👤 Usuário de leitura definido: ${this.currentUserId}`);
  }

  /**
   * Retorna o ID do usuário atual
   */
  getCurrentUserId(): string {
    return this.currentUserId;
  }

  /**
   * Verifica se o usuário atual é guest
   */
  isGuestUser(): boolean {
    return this.currentUserId === GUEST_USER_ID;
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!this.isBrowser) {
        return reject('Not in browser');
      }
      // Incrementar a versão para forçar o upgrade (v3 para sync_queue)
      const request = indexedDB.open(this.dbName, 3);

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

        // Store de progresso de leitura
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('chapterId', 'chapterId', { unique: false });
        }

        // Nova store de fila de sincronização (background sync)
        if (!db.objectStoreNames.contains(this.syncStoreName)) {
          db.createObjectStore(this.syncStoreName, { keyPath: 'chapterId' });
        }
      };
    });
  }

  /**
   * Gera a chave composta para o registro
   */
  private generateKey(chapterId: string, userId?: string): string {
    return `${userId || this.currentUserId}_${chapterId}`;
  }

  async saveProgress(chapterId: string, bookId: string, pageIndex: number, userId?: string): Promise<void> {
    if (!this.isBrowser || !this.dbPromise) return;

    const targetUserId = userId || this.currentUserId;

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const progress: ReadingProgress = {
          id: this.generateKey(chapterId, targetUserId),
          chapterId,
          bookId,
          userId: targetUserId,
          pageIndex,
          updatedAt: new Date()
        };

        const request = store.put(progress);

        request.onsuccess = () => {
          console.log(`✅ Progresso salvo para usuário ${targetUserId}, capítulo ${chapterId}, página ${pageIndex}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao salvar progresso de leitura:', error);
    }
  }

  /**
   * Adiciona um item à fila de sincronização em background
   */
  async enqueueSync(item: SyncQueueItem): Promise<void> {
    if (!this.isBrowser || !this.dbPromise) return;

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.syncStoreName], 'readwrite');
        const store = transaction.objectStore(this.syncStoreName);
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao enfileirar sincronização:', error);
    }
  }

  /**
   * Obtém todos os itens da fila de sincronização
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    if (!this.isBrowser || !this.dbPromise) return [];

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.syncStoreName], 'readonly');
        const store = transaction.objectStore(this.syncStoreName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao recuperar fila de sincronização:', error);
      return [];
    }
  }

  /**
   * Remove um item da fila de sincronização
   */
  async removeFromSyncQueue(chapterId: string): Promise<void> {
    if (!this.isBrowser || !this.dbPromise) return;

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.syncStoreName], 'readwrite');
        const store = transaction.objectStore(this.syncStoreName);
        const request = store.delete(chapterId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao remover da fila de sincronização:', error);
    }
  }

  async getProgress(chapterId: string, userId?: string): Promise<ReadingProgress | undefined> {
    if (!this.isBrowser || !this.dbPromise) return undefined;

    const targetUserId = userId || this.currentUserId;
    const key = this.generateKey(chapterId, targetUserId);

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

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

  async deleteProgress(chapterId: string, userId?: string): Promise<void> {
    if (!this.isBrowser || !this.dbPromise) return;

    const targetUserId = userId || this.currentUserId;
    const key = this.generateKey(chapterId, targetUserId);

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao deletar progresso:', error);
    }
  }

  /**
   * Obtém todos os progressos de leitura do usuário atual
   * Usado para sincronizar com o servidor quando o usuário faz login
   */
  async getAllProgress(userId?: string): Promise<ReadingProgress[]> {
    if (!this.isBrowser || !this.dbPromise) return [];

    const targetUserId = userId || this.currentUserId;

    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('userId');
        const request = index.getAll(targetUserId);

        request.onsuccess = () => {
          resolve(request.result as ReadingProgress[]);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Erro ao recuperar todos os progressos:', error);
      return [];
    }
  }

  /**
   * Obtém os progressos do usuário guest (para migrar após login)
   */
  async getGuestProgress(): Promise<ReadingProgress[]> {
    return this.getAllProgress(GUEST_USER_ID);
  }

  /**
   * Migra os progressos do guest para o usuário logado
   * Mantém o maior progresso entre guest e usuário
   */
  async migrateGuestProgressToUser(userId: string): Promise<void> {
    if (!this.isBrowser || !this.dbPromise) return;

    const guestProgress = await this.getGuestProgress();

    if (guestProgress.length === 0) {
      console.log('📭 Nenhum progresso guest para migrar');
      return;
    }

    console.log(`🔄 Migrando ${guestProgress.length} progressos do guest para usuário ${userId}...`);

    for (const progress of guestProgress) {
      // Verifica se o usuário já tem progresso para este capítulo
      const userProgress = await this.getProgress(progress.chapterId, userId);

      // Só migra se o progresso guest for maior
      if (!userProgress || progress.pageIndex > userProgress.pageIndex) {
        await this.saveProgress(
          progress.chapterId,
          progress.bookId,
          progress.pageIndex,
          userId
        );
        console.log(`✅ Migrado: ${progress.chapterId} (página ${progress.pageIndex})`);
      }

      // Remove o progresso guest após migrar
      await this.deleteProgress(progress.chapterId, GUEST_USER_ID);
    }

    console.log('✅ Migração de progressos guest concluída');
  }

  /**
   * Obtém o último progresso de leitura para um livro específico
   * Retorna o progresso mais recente (último capítulo lido)
   */
  async getLastProgressForBook(bookId: string, userId?: string): Promise<ReadingProgress | undefined> {
    if (!this.isBrowser || !this.dbPromise) return undefined;

    const targetUserId = userId || this.currentUserId;

    try {
      const allProgress = await this.getAllProgress(targetUserId);
      const bookProgress = allProgress.filter(p => p.bookId === bookId);

      if (bookProgress.length === 0) return undefined;

      // Retorna o progresso mais recente
      return bookProgress.reduce((latest, current) => {
        return new Date(current.updatedAt) > new Date(latest.updatedAt) ? current : latest;
      });
    } catch (error) {
      console.error('Erro ao obter último progresso do livro:', error);
      return undefined;
    }
  }

  /**
   * Limpa os progressos que já foram sincronizados
   */
  async clearSyncedProgress(chapterIds: string[], userId?: string): Promise<void> {
    if (!this.isBrowser || !this.dbPromise || chapterIds.length === 0) return;

    const targetUserId = userId || this.currentUserId;

    try {
      const db = await this.dbPromise;
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      for (const chapterId of chapterIds) {
        const key = this.generateKey(chapterId, targetUserId);
        store.delete(key);
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Erro ao limpar progressos sincronizados:', error);
    }
  }
}
