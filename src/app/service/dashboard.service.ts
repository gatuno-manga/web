import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardOverview, DashboardProgress } from '../models/dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  constructor(private http: HttpClient) {}

  getOverview(): Observable<DashboardOverview> {
    return this.http.get<DashboardOverview>('dashboard/overview');
  }

  getProgressBooks(): Observable<DashboardProgress> {
    // TODO: Implement backend endpoint for this or return dummy/empty for now to fix build
    // Returning empty structure as placeholder
    return new Observable(observer => {
        observer.next({
            totalChapters: 0,
            processingChapters: 0,
            books: []
        });
        observer.complete();
    });
  }
}