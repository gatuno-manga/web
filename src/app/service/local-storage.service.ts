import { Injectable, PLATFORM_ID, inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

@Injectable({
    providedIn: 'root',
})
export class LocalStorageService {
    KEY = '@gatuno';
    private platformId = inject(PLATFORM_ID);
    private isBrowser: boolean;

    constructor() {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    set(key: string, value: string) {
        if (this.isBrowser) {
            localStorage.setItem(`${this.KEY}/${key}`, value);
        }
    }
    get(key: string): string | null {
        if (this.isBrowser) {
            return localStorage.getItem(`${this.KEY}/${key}`);
        }
        return null;
    }
    delete(key: string) {
        if (this.isBrowser) {
            localStorage.removeItem(`${this.KEY}/${key}`);
        }
    }
    clear() {
        if (this.isBrowser) {
            localStorage.clear();
        }
    }
    has(key: string): boolean {
        if (this.isBrowser) {
            return localStorage.getItem(`${this.KEY}/${key}`) !== null;
        }
        return false;
    }
    keys(): string[] {
        const keys: string[] = [];
        if (this.isBrowser) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`${this.KEY}/`)) {
                    keys.push(key.replace(`${this.KEY}/`, ''));
                }
            }
        }
        return keys;
    }
}
