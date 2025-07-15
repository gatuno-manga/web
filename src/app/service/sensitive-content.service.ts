import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { CookieService } from "ngx-cookie-service";
import { SensitiveContent } from "../models/book.models";

@Injectable({
    providedIn: 'root',
})
export class SensitiveContentService {
    KEY = 'sensitive-content-allow';
    constructor(
        private readonly http: HttpClient,
        private readonly cookieService: CookieService
    ) {
        this.setDefaultContentAllow();
    }

    getContentAllow(): SensitiveContent[] {
        const content = this.cookieService.get(this.KEY);
        if (!content) return [];
        try {
            return JSON.parse(content) as SensitiveContent[];
        } catch (error) {
            console.error('Error parsing content allow:', error);
            return [];
        }
    }

    setContentAllow(content: SensitiveContent[]): void {
        this.cookieService.set(this.KEY, JSON.stringify(content));
    }

    private setDefaultContentAllow(): void {
        if (!this.cookieService.get(this.KEY)) {
            const defaultContent = [
                SensitiveContent.SAFE,
            ];
            this.setContentAllow(defaultContent);
        }
    }
}
