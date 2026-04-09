export interface ActiveSession {
	id: string;
	deviceLabel: string | null;
	deviceId: string | null;
	clientPlatform: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	authMethod: 'password' | 'passkey';
	mfaVerified: boolean;
	riskLevel: 'low' | 'high';
	lastSeenAt: string;
	createdAt: string;
	isCurrent: boolean;
}

export interface MfaStatusResponse {
	totpEnabled: boolean;
	backupCodesRemaining: number;
}

export interface MfaSetupResponse {
	secret: string;
	otpauthUri: string;
}

export interface MfaSetupVerifyResponse {
	enabled: boolean;
	backupCodes: string[];
}

export interface PasskeySummary {
	id: string;
	credentialId: string;
	name: string | null;
	deviceType: string | null;
	backedUp: boolean;
	lastUsedAt: string | null;
	createdAt: string;
}

export interface AuditLogItem {
	id: string;
	event: string;
	success: boolean;
	sessionId: string | null;
	authMethod: string | null;
	riskLevel: string | null;
	deviceId: string | null;
	deviceLabel: string | null;
	clientPlatform: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
}

export interface AuditHistoryResponse {
	items: AuditLogItem[];
	total: number;
	page: number;
	limit: number;
}
