import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { DashboardOverview, DashboardProgress } from "../models/dashboard.models";

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    constructor(private readonly http: HttpClient) {}

    getOverview() {
        return this.http.get<DashboardOverview>('books/dashboard/overview');
    }

    getProgressBooks() {
        return this.http.get<DashboardProgress>('books/dashboard/process-book');
    }
}
