import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, filter, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthQueueService {
  private isRefreshingSubject = new BehaviorSubject<boolean>(false);
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);
  private hasError = false;

  get isRefreshing(): boolean {
    return this.isRefreshingSubject.value;
  }

  get token$(): Observable<string | null> {
    return this.refreshTokenSubject.asObservable();
  }

  startRefreshing(): void {
    this.hasError = false;
    this.isRefreshingSubject.next(true);
    this.refreshTokenSubject.next(null);
  }

  notifySuccess(token: string): void {
    this.hasError = false;
    this.isRefreshingSubject.next(false);
    this.refreshTokenSubject.next(token);
  }

  notifyFailure(error: any): void {
    this.hasError = true;
    this.isRefreshingSubject.next(false);
    this.refreshTokenSubject.next(null);
  }

  get hasFailed(): boolean {
    return this.hasError && !this.isRefreshingSubject.value;
  }

  reset(): void {
    this.hasError = false;
    this.isRefreshingSubject.next(false);
    this.refreshTokenSubject.next(null);
  }
}
