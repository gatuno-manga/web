import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
	authTokensResponse,
	isAuthTokensResponse,
	loginRequest,
	loginResponse,
	registerRequest,
} from '../models/user.models';
import { tap } from 'rxjs';
import { UserTokenService } from './user-token.service';
import { UnifiedReadingProgressService } from './unified-reading-progress.service';

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	private readingProgressService = inject(UnifiedReadingProgressService);

	constructor(
		private readonly http: HttpClient,
		private readonly userTokenService: UserTokenService,
	) {}

	login(data: loginRequest) {
		return this.http
			.post<loginResponse>('/auth/signin', data, {
				observe: 'response',
				withCredentials: true,
			})
			.pipe(
				tap(({ body }) => {
					if (body && isAuthTokensResponse(body)) {
						this.userTokenService.setTokens(body.accessToken);
						// Sincroniza o histórico de leitura após o login
						this.readingProgressService.onUserLogin();
					}
				}),
			);
	}

	verifyMfaLogin(mfaToken: string, code: string) {
		return this.http
			.post<authTokensResponse>(
				'/auth/mfa/verify-login',
				{ mfaToken, code },
				{
					observe: 'response',
					withCredentials: true,
				},
			)
			.pipe(
				tap(({ body }) => {
					if (body?.accessToken) {
						this.userTokenService.setTokens(body.accessToken);
						this.readingProgressService.onUserLogin();
					}
				}),
			);
	}

	beginPasskeyAuthentication(email: string) {
		return this.http.post<Record<string, unknown>>(
			'/auth/passkeys/authenticate/options',
			{ email },
		);
	}

	verifyPasskeyAuthentication(
		email: string,
		response: Record<string, unknown>,
	) {
		return this.http
			.post<loginResponse>(
				'/auth/passkeys/authenticate/verify',
				{ email, response },
				{
					observe: 'response',
					withCredentials: true,
				},
			)
			.pipe(
				tap(({ body }) => {
					if (body && isAuthTokensResponse(body)) {
						this.userTokenService.setTokens(body.accessToken);
						this.readingProgressService.onUserLogin();
					}
				}),
			);
	}

	logout() {
		const csrfToken = this.userTokenService.csrfToken;
		return this.http
			.get('/auth/logout', {
				withCredentials: true,
				headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
			})
			.pipe(
				tap(() => {
					this.userTokenService.removeTokens();
					// Reseta o estado de leitura para guest
					this.readingProgressService.onUserLogout();
				}),
			);
	}

	register(data: registerRequest) {
		return this.http
			.post<authTokensResponse>('/auth/signup', data, {
				observe: 'response',
				withCredentials: true,
			})
			.pipe(
				tap(({ body }) => {
					if (body) {
						this.userTokenService.setTokens(body.accessToken);
						// Sincroniza o histórico de leitura após o registro
						this.readingProgressService.onUserLogin();
					}
				}),
			);
	}
}
