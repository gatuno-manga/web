import { Injectable } from "@angular/core";
import { CookieService as AgCookieService } from 'ngx-cookie-service';
@Injectable({
    providedIn: 'root',
})
export class CookieService {
    KEY = '@gatuno';
    cookieConfig: { path?: string; expires?: Date; secure?: boolean } = {};
    constructor(
        private cookieService: AgCookieService
    ) {
        this.cookieConfig = {
            path: '/',
            secure: false,
            expires: new Date(new Date().setDate(new Date().getDate() + 7))
        };
    }

    set(key: string, value: string, options?: { path?: string; expires?: Date; secure?: boolean }) {
        const cookieOptions = { ...this.cookieConfig, ...options };
        this.cookieService.set(`${this.KEY}/${key}`, value, cookieOptions);
    }

    get(key: string) {
        return this.cookieService.get(`${this.KEY}/${key}`);
    }

    delete(key: string) {
        this.cookieService.delete(`${this.KEY}/${key}`, this.cookieConfig.path);
    }
}
