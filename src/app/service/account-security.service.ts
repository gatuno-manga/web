import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import {
	ActiveSession,
	AuditHistoryResponse,
	MfaSetupResponse,
	MfaSetupVerifyResponse,
	MfaStatusResponse,
	PasskeySummary,
} from '../models/account-security.models';

@Injectable({
	providedIn: 'root',
})
export class AccountSecurityService {
	constructor(private readonly http: HttpClient) {}

	private unwrapData<T>(payload: T | { data: T }): T {
		if (
			payload &&
			typeof payload === 'object' &&
			'data' in payload &&
			(payload as { data?: T }).data !== undefined
		) {
			return (payload as { data: T }).data;
		}

		return payload as T;
	}

	getSessions() {
		return this.http
			.get<ActiveSession[] | { data: ActiveSession[] }>('/auth/sessions')
			.pipe(map((response) => this.unwrapData(response)));
	}

	revokeSession(sessionId: string, reason?: string) {
		return this.http
			.delete<{ message: string } | { data: { message: string } }>(
				`/auth/sessions/${sessionId}`,
				{
					body: reason ? { reason } : undefined,
				},
			)
			.pipe(map((response) => this.unwrapData(response)));
	}

	revokeOtherSessions() {
		return this.http
			.delete<
				| { message: string; revokedSessions: number }
				| { data: { message: string; revokedSessions: number } }
			>('/auth/sessions/others')
			.pipe(map((response) => this.unwrapData(response)));
	}

	getAuditHistory(page = 1, limit = 20, event?: string) {
		let params = new HttpParams()
			.set('page', String(page))
			.set('limit', String(limit));
		if (event && event.trim().length > 0) {
			params = params.set('event', event.trim());
		}

		return this.http
			.get<AuditHistoryResponse | { data: AuditHistoryResponse }>(
				'/auth/audit-history',
				{
					params,
				},
			)
			.pipe(map((response) => this.unwrapData(response)));
	}

	getMfaStatus() {
		return this.http
			.get<MfaStatusResponse | { data: MfaStatusResponse }>(
				'/auth/mfa/status',
			)
			.pipe(map((response) => this.unwrapData(response)));
	}

	beginTotpSetup() {
		return this.http
			.post<MfaSetupResponse | { data: MfaSetupResponse }>(
				'/auth/mfa/totp/setup',
				{},
			)
			.pipe(map((response) => this.unwrapData(response)));
	}

	verifyTotpSetup(code: string) {
		return this.http
			.post<MfaSetupVerifyResponse>('/auth/mfa/totp/verify-setup', {
				code,
			})
			.pipe(map((response) => this.unwrapData(response)));
	}

	disableTotp(code: string) {
		return this.http
			.post<{ enabled: boolean } | { data: { enabled: boolean } }>(
				'/auth/mfa/totp/disable',
				{
					code,
				},
			)
			.pipe(map((response) => this.unwrapData(response)));
	}

	listPasskeys() {
		return this.http
			.get<PasskeySummary[] | { data: PasskeySummary[] }>(
				'/auth/passkeys',
			)
			.pipe(map((response) => this.unwrapData(response)));
	}

	beginPasskeyRegistration() {
		return this.http
			.post<Record<string, unknown> | { data: Record<string, unknown> }>(
				'/auth/passkeys/register/options',
				{},
			)
			.pipe(map((response) => this.unwrapData(response)));
	}

	verifyPasskeyRegistration(
		response: Record<string, unknown>,
		name?: string,
	) {
		return this.http
			.post<
				| { id: string; credentialId: string; name: string | null }
				| {
						data: {
							id: string;
							credentialId: string;
							name: string | null;
						};
				  }
			>('/auth/passkeys/register/verify', {
				response,
				name,
			})
			.pipe(map((payload) => this.unwrapData(payload)));
	}

	deletePasskey(passkeyId: string) {
		return this.http
			.delete<{ message: string } | { data: { message: string } }>(
				`/auth/passkeys/${passkeyId}`,
			)
			.pipe(map((response) => this.unwrapData(response)));
	}
}
