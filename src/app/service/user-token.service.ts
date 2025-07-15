import { Injectable } from "@angular/core";
import { CookieService } from "./cookie.service";
import { HttpClient } from "@angular/common/http";
import { jwtDecode } from 'jwt-decode';
import { payloadToken, Role } from "../models/user.models";

@Injectable({
    providedIn: 'root',
})
export class UserTokenService {
    ACCESSKEY = 'accessToken';
    REFRESHKEY = 'refreshToken';
    constructor(
        private readonly http: HttpClient,
        private cookieService: CookieService
    ) {}

    setTokens(accessToken: string, refreshToken: string) {
        this.cookieService.set(this.ACCESSKEY, accessToken);
        this.cookieService.set(this.REFRESHKEY, refreshToken);
    }

    removeAccessToken(): void {
        this.cookieService.delete(this.ACCESSKEY);
    }

    removeRefreshToken(): void {
        this.cookieService.delete(this.REFRESHKEY);
    }

    removeTokens(): void {
        this.removeAccessToken();
        this.removeRefreshToken();
    }

    get AccessToken(): string | null {
        return this.cookieService.get(this.ACCESSKEY)
    }
    get RefreshToken(): string | null {
        return this.cookieService.get(this.REFRESHKEY);
    }

    isTokenValid(token: string): boolean {
        try {
            const { exp, iss } = jwtDecode<payloadToken>(token);
            console.log('isTokenValid', exp, iss);
            if (!exp) return false;

            const currentTime = Math.floor(Date.now() / 1000);
            return exp > currentTime && iss === 'login';
        } catch (error) {
            return false;
        }
    }

    get hasToken() {
        const token = this.AccessToken;
        if (!token) return false;

        if (!this.isTokenValid(token)) {
            this.removeAccessToken();
            return false;
        }
        return true;
    }

    get timeToExpire() {
        const token = this.AccessToken;
        if (!token) return 0;
        const { exp } = jwtDecode<payloadToken>(token);
        if (!exp) return 0;
        return exp;
    }

    get userId() {
        const token = this.AccessToken;
        if (!token) return 0;
        const { sub } = jwtDecode<payloadToken>(token);
        if (!sub) return 0;
        return sub;
    }

    private hasRole(role: Role): boolean {
        const token = this.AccessToken;
        if (!token) return false;

        if (!this.isTokenValid(token)) {
            this.removeAccessToken();
            return false;
        }

        const { roles } = jwtDecode<payloadToken>(token);
        if (!roles) return false;

        return Array.isArray(roles) && roles.includes(role);
    }

    refreshTokens() {
        const refreshToken = this.RefreshToken;
        if (!refreshToken) {
            return this.http.post<{ accessToken: string, refreshToken: string }>('/auth/refresh', {});
        }

        return this.http.post<{ accessToken: string, refreshToken: string }>('/auth/refresh', { refreshToken });
    }
}
