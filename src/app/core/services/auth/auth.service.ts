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
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CsrfService } from './csrf.service';
import { retryOnInvalidCsrf } from './refresh-error.util';
import { UserTokenService } from './user-token.service';

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	private readonly http = inject(HttpClient);
	private readonly userTokenService = inject(UserTokenService);
	private readonly csrfService = inject(CsrfService);

	login(payload: loginRequest) {
		return this.http
			.post<loginResponse>('/auth/signin', payload, {
				observe: 'response',
				withCredentials: true,
			})
			.pipe(
				tap((response) => {
					const body = response.body;
					if (body && isAuthTokensResponse(body)) {
						this.userTokenService.setTokens(
							body.accessToken,
							body.csrfToken,
						);
					}
				}),
			);
	}

	verifyMfaLogin(mfaToken: string, code: string) {
		return this.http
			.post<authTokensResponse>(
				'/auth/mfa/verify-login',
				{ mfaToken, code },
				{ observe: 'response', withCredentials: true },
			)
			.pipe(
				tap((response) => {
					const body = response.body;
					if (body && isAuthTokensResponse(body)) {
						this.userTokenService.setTokens(
							body.accessToken,
							body.csrfToken,
						);
					}
				}),
			);
	}

	logout() {
		return retryOnInvalidCsrf(() =>
			this.executeLogout(this.csrfService.csrfToken?.trim() || undefined),
		).pipe(
			catchError(() => of(undefined)),
			tap(() => {
				this.userTokenService.removeTokens(false);
			}),
		);
	}

	private executeLogout(csrfToken?: string) {
		return this.http.get<void>('/auth/logout', {
			withCredentials: true,
			headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
		});
	}

	register(payload: registerRequest) {
		return this.http
			.post<authTokensResponse>('/auth/signup', payload, {
				observe: 'response',
				withCredentials: true,
			})
			.pipe(
				tap((response) => {
					const body = response.body;
					if (body && isAuthTokensResponse(body)) {
						this.userTokenService.setTokens(
							body.accessToken,
							body.csrfToken,
						);
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
				{ observe: 'response', withCredentials: true },
			)
			.pipe(
				tap((res) => {
					const body = res.body;
					if (body && isAuthTokensResponse(body)) {
						this.userTokenService.setTokens(
							body.accessToken,
							body.csrfToken,
						);
					}
				}),
			);
	}
}
