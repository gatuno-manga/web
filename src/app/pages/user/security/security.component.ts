import { CommonModule } from '@angular/common';
import {
	Component,
	OnInit,
	ChangeDetectorRef,
	ChangeDetectionStrategy,
	input,
	inject,
	computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { startRegistration } from '@simplewebauthn/browser';
import { firstValueFrom } from 'rxjs';
import {
	ActiveSession,
	AuditLogItem,
	MfaSetupResponse,
	MfaStatusResponse,
	PasskeySummary,
} from '../../../models/account-security.models';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { SwitchComponent } from '../../../components/inputs/switch/switch.component';
import { IconsComponent } from '../../../components/icons/icons.component';
import { AccountSecurityService } from '../../../service/account-security.service';
import { SearchService } from '../../../service/search.service';

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

	private loadAll(): void {
		this.loadSessions();
		this.loadAuditHistory();
		this.loadPasskeys();
		this.loadMfaStatus();
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

	loadSessions(): void {
		this.securityService.getSessions().subscribe({
			next: (sessions) => {
				this.sessions = sessions;
				this.cdr.markForCheck();
			},
			error: () => {
				this.setError('Falha ao carregar sessões ativas.');
			},
		});
	}

	loadAuditHistory(): void {
		this.securityService.getAuditHistory(1, 20).subscribe({
			next: (history) => {
				this.auditItems = history.items ?? [];
				this.cdr.markForCheck();
			},
			error: () => {
				this.setError('Falha ao carregar histórico de acessos.');
			},
		});
	}

	loadPasskeys(): void {
		this.securityService.listPasskeys().subscribe({
			next: (passkeys) => {
				this.passkeys = passkeys;
				this.cdr.markForCheck();
			},
			error: () => {
				this.setError('Falha ao carregar passkeys.');
			},
		});
	}

	loadMfaStatus(): void {
		this.securityService.getMfaStatus().subscribe({
			next: (status) => {
				this.mfaStatus = status;
				this.cdr.markForCheck();
			},
			error: () => {
				this.setError('Falha ao carregar status de MFA.');
			},
		});
	}

	revokeSession(sessionId: string): void {
		this.clearMessages();
		this.securityService
			.revokeSession(sessionId, 'revogada pelo usuário')
			.subscribe({
				next: () => {
					this.setFeedback('Sessão encerrada com sucesso.');
					this.loadSessions();
				},
				error: () => {
					this.setError('Falha ao encerrar sessão.');
				},
			});
	}

	revokeOtherSessions(): void {
		this.clearMessages();
		this.securityService.revokeOtherSessions().subscribe({
			next: ({ revokedSessions }) => {
				this.setFeedback(
					`Sessões encerradas com sucesso. Total revogado: ${revokedSessions}.`,
				);
				this.loadSessions();
			},
			error: () => {
				this.setError('Falha ao encerrar outras sessões.');
			},
		});
	}

	toggleMfa(): void {
		if (this.mfaStatus?.totpEnabled) {
			this.isDisablingMfa = !this.isDisablingMfa;
		} else {
			this.beginTotpSetup();
		}
		this.cdr.markForCheck();
	}

	beginTotpSetup(): void {
		this.clearMessages();
		this.securityService.beginTotpSetup().subscribe({
			next: (setup) => {
				this.mfaSetup = setup;
				this.backupCodes = [];
				this.setFeedback(
					'Escaneie o QR/URI no app autenticador e confirme com o código.',
				);
			},
			error: () => {
				this.setError('Falha ao iniciar configuração de MFA.');
			},
		});
	}

	confirmTotpSetup(): void {
		if (!this.mfaSetupCode.trim()) {
			this.setError('Informe o código do app autenticador.');
			return;
		}

		this.clearMessages();
		this.securityService
			.verifyTotpSetup(this.mfaSetupCode.trim())
			.subscribe({
				next: (result) => {
					this.backupCodes = result.backupCodes ?? [];
					this.mfaSetup = null;
					this.mfaSetupCode = '';
					this.setFeedback('MFA habilitado com sucesso.');
					this.loadMfaStatus();
				},
				error: () => {
					this.setError('Código MFA inválido para ativação.');
				},
			});
	}

	confirmDisableTotp(): void {
		if (!this.mfaDisableCode.trim()) {
			this.setError('Informe um código para desativar o MFA.');
			return;
		}

		this.clearMessages();
		this.securityService.disableTotp(this.mfaDisableCode.trim()).subscribe({
			next: () => {
				this.mfaDisableCode = '';
				this.backupCodes = [];
				this.isDisablingMfa = false;
				this.setFeedback('MFA desativado com sucesso.');
				this.loadMfaStatus();
			},
			error: () => {
				this.setError('Falha ao desativar MFA. Verifique o código.');
			},
		});
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
				optionsJSON: options as never,
			});
			await firstValueFrom(
				this.securityService.verifyPasskeyRegistration(
					registration as unknown as Record<string, unknown>,
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

	removePasskey(passkeyId: string): void {
		this.clearMessages();
		this.securityService.deletePasskey(passkeyId).subscribe({
			next: () => {
				this.setFeedback('Passkey removida com sucesso.');
				this.loadPasskeys();
			},
			error: () => {
				this.setError('Falha ao remover passkey.');
			},
		});
	}
}
