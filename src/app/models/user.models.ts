export interface loginRequest {
	email: string;
	password: string;
}

export interface authTokensResponse {
	accessToken: string;
	refreshToken?: string;
	sessionId?: string;
}

export interface mfaChallengeResponse {
	mfaRequired: true;
	mfaType: 'totp';
	mfaToken: string;
}

export type loginResponse = authTokensResponse | mfaChallengeResponse;

export const isMfaChallengeResponse = (
	response: loginResponse,
): response is mfaChallengeResponse => {
	return 'mfaRequired' in response && response.mfaRequired === true;
};

export const isAuthTokensResponse = (
	response: loginResponse,
): response is authTokensResponse => {
	return (
		'accessToken' in response && typeof response.accessToken === 'string'
	);
};

export interface payloadToken {
	email: string;
	sub: string;
	roles: Role[];
	iss: string;
	iat: number;
	exp: number;
	sessionId?: string;
}

export enum Role {
	USER = 'user',
	ADMIN = 'admin',
}

export interface UserProfile {
	id: string;
	email: string;
	userName: string;
	name?: string;
	profileImageUrl?: string;
	profileBannerUrl?: string;
	roles: Role[];
	createdAt: string;
	updatedAt: string;
}

export interface registerRequest {
	email: string;
	password: string;
}
