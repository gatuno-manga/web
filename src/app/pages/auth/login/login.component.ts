import { Component, OnInit } from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { MetaDataService } from '@core/services/meta-data.service';
import {
	isAuthTokensResponse,
	isMfaChallengeResponse,
	loginResponse,
} from '@models/user.models';
import { startAuthentication } from '@simplewebauthn/browser';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { MfaInputComponent } from '@ui/atoms/inputs/mfa-input/mfa-input.component';
import {
	PasswordInputComponent,
	TextInputComponent,
} from '@ui/atoms/inputs/text-input/text-input.component';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'app-login',
	imports: [
		TextInputComponent,
		ButtonComponent,
		ReactiveFormsModule,
		RouterModule,
		PasswordInputComponent,
		MfaInputComponent,
		IconsComponent,
	],
	templateUrl: './login.component.html',
	styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
	form: FormGroup;
	private returnUrl = '/books';
	step: 'email' | 'password' | 'mfa' = 'email';
	private mfaToken: string | null = null;
	isLoading = false;

	constructor(
		private fb: FormBuilder,
		private readonly authService: AuthService,
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly metaService: MetaDataService,
	) {
		this.form = this.fb.group({
			email: ['', [Validators.required, Validators.email]],
			password: ['', [Validators.required]],
			mfaCode: [''],
		});
		this.returnUrl =
			this.route.snapshot.queryParamMap.get('returnUrl') || '/books';
		this.setMetaData();
	}

	ngOnInit(): void {
		// Tenta iniciar a autenticação por passkey (nameless/conditional UI) assim que a página carrega
		void this.signInWithPasskey(true);
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Login',
			description: 'Acesse sua conta.',
		});
	}

	nextStep() {
		if (this.form.get('email')?.invalid) {
			this.form.get('email')?.markAsTouched();
			return;
		}
		this.step = 'password';
	}

	private clearFormError(errorKey: string): void {
		const currentErrors = this.form.errors ?? {};
		if (!(errorKey in currentErrors)) {
			return;
		}

		delete currentErrors[errorKey];
		this.form.setErrors(
			Object.keys(currentErrors).length ? currentErrors : null,
		);
	}

	private handleAuthResult(response: loginResponse): void {
		if (isMfaChallengeResponse(response)) {
			this.step = 'mfa';
			this.mfaToken = response.mfaToken;
			this.form.get('password')?.reset();
			this.form.setErrors({
				...(this.form.errors ?? {}),
				mfaRequired:
					'Digite o código do app autenticador para continuar.',
			});
			return;
		}

		if (isAuthTokensResponse(response)) {
			this.clearFormError('mfaRequired');
			void this.router.navigateByUrl(this.returnUrl);
			return;
		}

		this.form.setErrors({
			...(this.form.errors ?? {}),
			loginFailed: 'Resposta de autenticação inválida',
		});
	}

	submit() {
		if (this.isLoading) return;

		if (this.step === 'mfa') {
			const code = this.form.get('mfaCode')?.value;
			if (!this.mfaToken || !code) {
				this.form.setErrors({
					...(this.form.errors ?? {}),
					mfaFailed: 'Código MFA é obrigatório',
				});
				return;
			}

			this.isLoading = true;
			this.authService
				.verifyMfaLogin(this.mfaToken, String(code))
				.subscribe({
					next: ({ body }) => {
						this.isLoading = false;
						if (!body) {
							this.form.setErrors({
								...(this.form.errors ?? {}),
								mfaFailed: 'Resposta de MFA inválida',
							});
							return;
						}
						this.handleAuthResult(body);
					},
					error: () => {
						this.isLoading = false;
						this.form.setErrors({
							...(this.form.errors ?? {}),
							mfaFailed: 'Código MFA inválido',
						});
					},
				});
			return;
		}

		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		this.isLoading = true;
		const payload = {
			email: String(this.form.get('email')?.value ?? ''),
			password: String(this.form.get('password')?.value ?? ''),
		};

		this.authService.login(payload).subscribe({
			next: ({ body }) => {
				this.isLoading = false;
				if (!body) {
					this.form.setErrors({
						...(this.form.errors ?? {}),
						loginFailed: 'Resposta de autenticação inválida',
						mfaRequired: null,
					});
					return;
				}
				this.handleAuthResult(body);
			},
			error: () => {
				this.isLoading = false;
				this.form.setErrors({
					loginFailed: 'Email ou senha inválidos',
				});
			},
		});
	}

	async signInWithPasskey(isAutofill = false) {
		if (this.isLoading && !isAutofill) return;

		const email = String(this.form.get('email')?.value ?? '').trim();

		// No modo autofill, não queremos mostrar loading spinner
		if (!isAutofill) this.isLoading = true;

		try {
			const options = await firstValueFrom(
				this.authService.beginPasskeyAuthentication(email || undefined),
			);
			if (!options) {
				throw new Error('Passkey options not received');
			}

			const assertion = await startAuthentication({
				optionsJSON: options as never,
				useBrowserAutofill: isAutofill,
			});

			// Se chegamos aqui, o usuário selecionou uma passkey
			if (isAutofill) this.isLoading = true;

			const response = await firstValueFrom(
				this.authService.verifyPasskeyAuthentication(
					assertion as unknown as Record<string, unknown>,
					email || undefined,
				),
			);

			this.isLoading = false;
			if (!response?.body) {
				throw new Error('Passkey authentication response missing');
			}

			this.handleAuthResult(response.body);
		} catch (error: any) {
			if (!isAutofill) {
				console.error('Passkey sign-in failed', error);
				this.isLoading = false;

				const isNotAllowed = error?.name === 'NotAllowedError';
				const passkeyFailed =
					!email && isNotAllowed
						? 'Nenhuma passkey encontrada no dispositivo. Digite seu e-mail caso possua passkeys em outros dispositivos.'
						: 'Falha ao autenticar com passkey.';

				this.form.setErrors({
					...(this.form.errors ?? {}),
					passkeyFailed,
				});
			} else {
				// Erros silenciosos no autofill (ex: cancelado pelo navegador ou sem suporte)
				console.debug(
					'Conditional UI passkey login skipped or failed',
					error,
				);
			}
		}
	}
}
