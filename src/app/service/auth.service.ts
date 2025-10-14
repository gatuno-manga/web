import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { loginRequest, loginResponse, registerRequest } from "../models/user.models";
import { tap } from "rxjs";
import { CookieService } from "./cookie.service";
import { UserTokenService } from "./user-token.service";
import { TokenRefreshTimerService } from "./token-refresh-timer.service";

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private tokenRefreshTimer = inject(TokenRefreshTimerService);

    constructor(
        private readonly http: HttpClient,
        private readonly userTokenService: UserTokenService
    ) {}

    login(data: loginRequest) {
        return this.http
            .post<loginResponse>('/auth/signin', data,
                { observe: 'response' }
            )
            .pipe(
                tap(({ body }) => {
                    if (body) {
                        this.userTokenService.setTokens(body.accessToken, body.refreshToken);
                        this.tokenRefreshTimer.startAutoRefresh();
                    }
                })
            );
    }

    logout() {
        return this.http.get('/auth/logout',
            {
                withCredentials: true
            }
        )
            .pipe(
                tap(() => {
                    this.userTokenService.removeTokens();
                    this.tokenRefreshTimer.stopAutoRefresh();
                })
            );
    }

    register(data: registerRequest) {
        return this.http
            .post<loginResponse>('/auth/signup', data,
                {
                    observe: 'response',
                }
            )
            .pipe(
                tap(({ body }) => {
                    if (body) {
                        this.userTokenService.setTokens(body.accessToken, body.refreshToken);
                        this.tokenRefreshTimer.startAutoRefresh();
                    }
                })
            );
    }
}
