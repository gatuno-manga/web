import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthQueueService {
  private isRefreshingSubject = new BehaviorSubject<boolean>(false);
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  get isRefreshing(): boolean {
    return this.isRefreshingSubject.value;
  }

  get token$(): Observable<string | null> {
    return this.refreshTokenSubject.asObservable();
  }

  /**
   * Inicia o processo de refresh.
   * Bloqueia novas requisições e limpa o subject atual.
   */
  startRefreshing(): void {
    this.isRefreshingSubject.next(true);
    this.refreshTokenSubject.next(null);
  }

  /**
   * Notifica todas as requisições na fila com o novo token.
   */
  notifySuccess(token: string): void {
    this.isRefreshingSubject.next(false);
    this.refreshTokenSubject.next(token);
  }

  /**
   * Notifica erro para todas as requisições na fila.
   * Reinicia o Subject para evitar estado "morto".
   */
  notifyFailure(error: any): void {
    this.isRefreshingSubject.next(false);
    
    // Emite o erro para quem está ouvindo agora
    this.refreshTokenSubject.error(error);
    
    // Reseta o Subject para futuras tentativas
    this.refreshTokenSubject = new BehaviorSubject<string | null>(null);
  }
}
