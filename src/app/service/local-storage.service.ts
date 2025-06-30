import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root',
})
export class LocalStorageService {
    KEY = '@gatuno';
    constructor() {}

    set(key: string, value: string) {
        localStorage.setItem(`${this.KEY}/${key}`, value);
    }
    get(key: string): string | null {
        return localStorage.getItem(`${this.KEY}/${key}`);
    }
    delete(key: string) {
        localStorage.removeItem(`${this.KEY}/${key}`);
    }
    clear() {
        localStorage.clear();
    }
    has(key: string): boolean {
        return localStorage.getItem(`${this.KEY}/${key}`) !== null;
    }
    keys(): string[] {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${this.KEY}/`)) {
                keys.push(key.replace(`${this.KEY}/`, ''));
            }
        }
        return keys;
    }
}
