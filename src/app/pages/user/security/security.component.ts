import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	computed,
	inject,
	input,
	OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountSecurityService } from '@core/services/account-security.service';
import { SearchService } from '@core/services/search.service';
import {
	ActiveSession,
	AuditLogItem,
	MfaSetupResponse,
	MfaStatusResponse,
	PasskeySummary,
} from '@models/account-security.models';
import {
	PublicKeyCredentialCreationOptionsJSON,
	startRegistration,
} from '@simplewebauthn/browser';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { SwitchComponent } from '@ui/atoms/inputs/switch/switch.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'app-security',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ButtonComponent,
		TextInputComponent,
		SwitchComponent,
		IconsComponent,
	],
	templateUrl: './security.component.html',
	styleUrl: './security.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityComponent implements OnInit {
	private readonly searchService = inject(SearchService);
	isListView = input<boolean>(false);
	private globalSearchQuery = this.searchService.query;

	showMfa = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return 'autenticação de dois fatores 2fa totp mfa'.includes(q);
	});

	showDevices = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return 'dispositivos conectados sessões'.includes(q);
	});

	showPasskeys = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return 'chaves de acessos passkeys'.includes(q);
	});

	sessions: ActiveSession[] = [];
	auditItems: AuditLogItem[] = [];
	passkeys: PasskeySummary[] = [];
	mfaStatus: MfaStatusResponse | null = null;
	mfaSetup: MfaSetupResponse | null = null;
	backupCodes: string[] = [];

	mfaSetupCode = '';
	mfaDisableCode = '';
	passkeyName = '';
	feedbackMessage = '';
	errorMessage = '';
	isLoading = false;
	isDisablingMfa = false;

	constructor(
		private readonly securityService: AccountSecurityService,
		private readonly cdr: ChangeDetectorRef,
	) {}

	ngOnInit(): void {
		this.loadAll();
	}

	private async loadAll(): Promise<void> {
		await Promise.all([
			this.loadSessions(),
			this.loadAuditHistory(),
			this.loadPasskeys(),
			this.loadMfaStatus(),
		]);
	}

	private setError(message: string): void {
		this.errorMessage = message;
		this.cdr.markForCheck();
	}

	private setFeedback(message: string): void {
		this.feedbackMessage = message;
		this.cdr.markForCheck();
	}

	private clearMessages(): void {
		this.errorMessage = '';
		this.feedbackMessage = '';
		this.cdr.markForCheck();
	}

	async loadSessions(): Promise<void> {
		try {
			this.sessions = await firstValueFrom(
				this.securityService.getSessions(),
			);
			this.cdr.markForCheck();
		} catch (_error) {
			this.setError('Falha ao carregar sessões ativas.');
		}
	}

	async loadAuditHistory(): Promise<void> {
		try {
			const history = await firstValueFrom(
				this.securityService.getAuditHistory(1, 20),
			);
			this.auditItems = history.items ?? [];
			this.cdr.markForCheck();
		} catch (_error) {
			this.setError('Falha ao carregar histórico de acessos.');
		}
	}

	async loadPasskeys(): Promise<void> {
		try {
			this.passkeys = await firstValueFrom(
				this.securityService.listPasskeys(),
			);
			this.cdr.markForCheck();
		} catch (_error) {
			this.setError('Falha ao carregar passkeys.');
		}
	}

	async loadMfaStatus(): Promise<void> {
		try {
			this.mfaStatus = await firstValueFrom(
				this.securityService.getMfaStatus(),
			);
			this.cdr.markForCheck();
		} catch (_error) {
			this.setError('Falha ao carregar status de MFA.');
		}
	}

	async revokeSession(sessionId: string): Promise<void> {
		this.clearMessages();
		try {
			await firstValueFrom(
				this.securityService.revokeSession(
					sessionId,
					'revogada pelo usuário',
				),
			);
			this.setFeedback('Sessão encerrada com sucesso.');
			await this.loadSessions();
		} catch (_error) {
			this.setError('Falha ao encerrar sessão.');
		}
	}

	async revokeOtherSessions(): Promise<void> {
		this.clearMessages();
		try {
			const { revokedSessions } = await firstValueFrom(
				this.securityService.revokeOtherSessions(),
			);
			this.setFeedback(
				`Sessões encerradas com sucesso. Total revogado: ${revokedSessions}.`,
			);
			await this.loadSessions();
		} catch (_error) {
			this.setError('Falha ao encerrar outras sessões.');
		}
	}

	toggleMfa(): void {
		if (this.mfaStatus?.totpEnabled) {
			this.isDisablingMfa = !this.isDisablingMfa;
		} else {
			this.beginTotpSetup();
		}
		this.cdr.markForCheck();
	}

	async beginTotpSetup(): Promise<void> {
		this.clearMessages();
		try {
			this.mfaSetup = await firstValueFrom(
				this.securityService.beginTotpSetup(),
			);
			this.backupCodes = [];
			this.setFeedback(
				'Escaneie o QR/URI no app autenticador e confirme com o código.',
			);
		} catch (_error) {
			this.setError('Falha ao iniciar configuração de MFA.');
		}
	}

	async confirmTotpSetup(): Promise<void> {
		if (!this.mfaSetupCode.trim()) {
			this.setError('Informe o código do app autenticador.');
			return;
		}

		this.clearMessages();
		try {
			const result = await firstValueFrom(
				this.securityService.verifyTotpSetup(this.mfaSetupCode.trim()),
			);
			this.backupCodes = result.backupCodes ?? [];
			this.mfaSetup = null;
			this.mfaSetupCode = '';
			this.setFeedback('MFA habilitado com sucesso.');
			await this.loadMfaStatus();
		} catch (_error) {
			this.setError('Código MFA inválido para ativação.');
		}
	}

	async confirmDisableTotp(): Promise<void> {
		if (!this.mfaDisableCode.trim()) {
			this.setError('Informe um código para desativar o MFA.');
			return;
		}

		this.clearMessages();
		try {
			await firstValueFrom(
				this.securityService.disableTotp(this.mfaDisableCode.trim()),
			);
			this.mfaDisableCode = '';
			this.backupCodes = [];
			this.isDisablingMfa = false;
			this.setFeedback('MFA desativado com sucesso.');
			await this.loadMfaStatus();
		} catch (_error) {
			this.setError('Falha ao desativar MFA. Verifique o código.');
		}
	}

	async registerPasskey(): Promise<void> {
		if (this.isLoading) {
			return;
		}
		this.clearMessages();
		this.isLoading = true;
		this.cdr.markForCheck();
		try {
			const options = await firstValueFrom(
				this.securityService.beginPasskeyRegistration(),
			);
			const registration = await startRegistration({
				optionsJSON:
					options as unknown as PublicKeyCredentialCreationOptionsJSON,
			});
			await firstValueFrom(
				this.securityService.verifyPasskeyRegistration(
					registration as unknown as Record<
						string,
						object | string | number | boolean | null | undefined
					>,
					this.passkeyName.trim() || undefined,
				),
			);
			this.setFeedback('Passkey registrada com sucesso.');
			this.passkeyName = '';
			this.loadPasskeys();
		} catch (error) {
			console.error('Passkey registration failed', error);
			this.setError('Falha ao registrar passkey.');
		} finally {
			this.isLoading = false;
			this.cdr.markForCheck();
		}
	}

	async removePasskey(passkeyId: string): Promise<void> {
		this.clearMessages();
		try {
			await firstValueFrom(this.securityService.deletePasskey(passkeyId));
			this.setFeedback('Passkey removida com sucesso.');
			await this.loadPasskeys();
		} catch (_error) {
			this.setError('Falha ao remover passkey.');
		}
	}
}
