import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
	authTokensResponse,
	isAuthTokensResponse,
	loginRequest,
	loginResponse,
	registerRequest,
} from '@models/user.models';
import { AuthenticationResponseJSON } from '@simplewebauthn/browser';
import { tap } from 'rxjs/operators';
import { SensitiveContentService } from './sensitive-content.service';
import { UnifiedReadingProgressService } from './unified-reading-progress.service';
import { UserTokenService } from './user-token.service';

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	private readonly http = inject(HttpClient);
	private readonly userTokenService = inject(UserTokenService);
	private readonly readingProgressService = inject(
		UnifiedReadingProgressService,
	);
	private readonly sensitiveContentService = inject(SensitiveContentService);

	login(payload: loginRequest) {
		return this.http
			.post<loginResponse>('/auth/signin', payload, {
				observe: 'response',
			})
			.pipe(
				tap((response) => {
					const body = response.body;
					if (body && isAuthTokensResponse(body)) {
						this.userTokenService.setTokens(
							body.accessToken,
							body.csrfToken,
						);
						// Sincroniza o histórico de leitura após o login
						this.readingProgressService.onUserLogin();
						this.sensitiveContentService.invalidateCache();
					}
				}),
			);
	}

	verifyMfaLogin(mfaToken: string, code: string) {
		return this.http
			.post<authTokensResponse>(
				'/auth/mfa/verify-login',
				{ mfaToken, code },
				{ observe: 'response' },
			)
			.pipe(
				tap((response) => {
					const body = response.body;
					if (body) {
						this.userTokenService.setTokens(
							body.accessToken,
							body.csrfToken,
						);
						// Sincroniza o histórico de leitura após o login
						this.readingProgressService.onUserLogin();
						this.sensitiveContentService.invalidateCache();
					}
				}),
			);
	}

	logout() {
		return this.http.get<void>('/auth/logout').pipe(
			tap(() => {
				this.userTokenService.removeTokens();
				this.readingProgressService.onUserLogout();
				this.sensitiveContentService.invalidateCache();
			}),
		);
	}

	register(payload: registerRequest) {
		return this.http
			.post<authTokensResponse>('/auth/signup', payload, {
				observe: 'response',
			})
			.pipe(
				tap((response) => {
					const body = response.body;
					if (body) {
						this.userTokenService.setTokens(
							body.accessToken,
							body.csrfToken,
						);
						// Sincroniza o histórico de leitura após o registro
						this.readingProgressService.onUserLogin();
						this.sensitiveContentService.invalidateCache();
					}
				}),
			);
	}

	beginPasskeyAuthentication(email?: string) {
		return this.http.post<
			Record<
				string,
				object | string | number | boolean | null | undefined
			>
		>('/auth/passkeys/authenticate/options', email ? { email } : {});
	}

	verifyPasskeyAuthentication(
		response: AuthenticationResponseJSON,
		email?: string,
	) {
		return this.http
			.post<loginResponse>(
				'/auth/passkeys/authenticate/verify',
				{ response, ...(email && { email }) },
				{ observe: 'response' },
			)
			.pipe(
				tap((res) => {
					const body = res.body;
					if (body && isAuthTokensResponse(body)) {
						this.userTokenService.setTokens(
							body.accessToken,
							body.csrfToken,
						);
						// Sincroniza o histórico de leitura após o login
						this.readingProgressService.onUserLogin();
						this.sensitiveContentService.invalidateCache();
					}
				}),
			);
	}
}
