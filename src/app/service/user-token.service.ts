import { Injectable } from "@angular/core";
import { CookieService } from "./cookie.service";
import { HttpClient } from "@angular/common/http";
import { jwtDecode } from 'jwt-decode';
import { payloadToken, Role } from "../models/user.models";
import { Observable, of } from 'rxjs';
import { shareReplay, switchMap, tap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class UserTokenService {
    ACCESSKEY = 'accessToken';
    REFRESHKEY = 'refreshToken';
    private refreshObservable: Observable<{ accessToken: string, refreshToken: string }> | null = null;

    constructor(
        private readonly http: HttpClient,
        private cookieService: CookieService
    ) {}

    setTokens(accessToken: string, refreshToken: string) {
        this.cookieService.set(this.ACCESSKEY, accessToken, false);
        this.cookieService.set(this.REFRESHKEY, refreshToken, false);
    }

    removeAccessToken(): void {
        this.cookieService.delete(this.ACCESSKEY, false);
    }

    removeRefreshToken(): void {
        this.cookieService.delete(this.REFRESHKEY, false);
    }

    removeTokens(): void {
        this.removeAccessToken();
        this.removeRefreshToken();
    }

    get accessToken(): string | null {
        return this.cookieService.get(this.ACCESSKEY, false)
    }
    get refreshToken(): string | null {
        return this.cookieService.get(this.REFRESHKEY, false);
    }

    private isTokenValid(token: string): boolean {
        try {
            const { exp, iss } = jwtDecode<payloadToken>(token);
            if (!exp) return false;

            const currentTime = Math.floor(Date.now() / 1000);
            return exp > currentTime && iss === 'login';
        } catch (error) {
            return false;
        }
    }

    get hasToken() {
        const token = this.accessToken;
        if (!token) return false;

        if (!this.isTokenValid(token)) {
            console.warn('Token inválido ou expirado');
            this.refreshTokens().pipe(
                switchMap(({ accessToken, refreshToken }) => {
                    this.setTokens(accessToken, refreshToken);
                    return of(true);
                })
            );
            return false;
        }
        return true;
    }

    get hasValidAccessToken() {
        const token = this.accessToken;
        if (!token) return false;
        return this.isTokenValid(token);
    }

    get hasValidRefreshToken() {
        const token = this.refreshToken;
        if (!token) return false;
        return this.isTokenValid(token);
    }

    get timeToExpire() {
        const token = this.accessToken;
        if (!token) return 0;
        const { exp } = jwtDecode<payloadToken>(token);
        if (!exp) return 0;
        return exp;
    }

    get userId() {
        const token = this.accessToken;
        if (!token) return 0;
        const { sub } = jwtDecode<payloadToken>(token);
        if (!sub) return 0;
        return sub;
    }

    private hasRole(role: Role): boolean {
        const token = this.accessToken;
        if (!token) return false;

        if (!this.isTokenValid(token)) {
            this.removeAccessToken();
            return false;
        }

        const { roles } = jwtDecode<payloadToken>(token);
        if (!roles) return false;

        return Array.isArray(roles) && roles.includes(role);
    }

    isAdmin(): boolean {
        return this.hasRole(Role.ADMIN);
    }

    refreshTokens() {
        if (!this.refreshObservable) {
            this.refreshObservable = this.http.get<{ accessToken: string, refreshToken: string }>('/auth/refresh', { withCredentials: true })
                .pipe(
                    tap(({ accessToken, refreshToken }) => {
                        console.log('Tokens refreshed successfully');
                        this.setTokens(accessToken, refreshToken);
                    }),
                    shareReplay(1)
                );
            this.refreshObservable.subscribe({
                complete: () => this.refreshObservable = null,
                error: () => this.refreshObservable = null
            });
        }
        return this.refreshObservable;
    }
}
