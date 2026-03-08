import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
	DashboardOverview,
	DashboardProgress,
	QueueStats,
} from '../models/dashboard.models';

@Injectable({
	providedIn: 'root',
})
export class DashboardService {
	constructor(private http: HttpClient) {}

	getOverview(): Observable<DashboardOverview> {
		const headers = new HttpHeaders({
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
			Expires: '0',
		});

		return this.http.get<DashboardOverview>('dashboard/overview', {
			headers,
		});
	}

	getProgressBooks(): Observable<DashboardProgress> {
		return this.http.get<DashboardProgress>('books/dashboard/process-book');
	}

	getQueueStats(): Observable<QueueStats> {
		return this.http.get<QueueStats>('books/dashboard/queue-stats');
	}

	forceUpdateAll(): Observable<void> {
		return this.http.post<void>('books/check-all-updates', {});
	}
}
