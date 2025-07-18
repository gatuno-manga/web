import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { CookieService } from "ngx-cookie-service";
import { SensitiveContentResponse } from "../models/book.models";

@Injectable({
    providedIn: 'root',
})
export class SensitiveContentService {
    KEY = 'sensitive-content-allow';
    constructor(
        private readonly http: HttpClient,
        private readonly cookieService: CookieService
    ) {}

    getContentAllow(): string[] {
        const content = this.cookieService.get(this.KEY);
        if (!content) return [];
        try {
            return JSON.parse(content) as string[];
        } catch (error) {
            console.error('Error parsing content allow:', error);
            return [];
        }
    }

    setContentAllow(content: string[]): void {
        this.cookieService.set(this.KEY, JSON.stringify(content));
    }

    getSensitiveContent() {
        return this.http.get<SensitiveContentResponse[]>('books/sensitive-content');
    }
}
