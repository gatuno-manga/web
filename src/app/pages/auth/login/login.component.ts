import { Component } from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { startAuthentication } from '@simplewebauthn/browser';
import { AuthService } from '../../../service/auth.service';
import {
	PasswordInputComponent,
	TextInputComponent,
} from '../../../components/inputs/text-input/text-input.component';
import { MfaInputComponent } from '../../../components/inputs/mfa-input/mfa-input.component';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { IconsComponent } from '../../../components/icons/icons.component';
import { MetaDataService } from '../../../service/meta-data.service';
import { firstValueFrom } from 'rxjs';
import {
	isAuthTokensResponse,
	isMfaChallengeResponse,
	loginResponse,
} from '../../../models/user.models';

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
export class LoginComponent {
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
		if (this.form.invalid || this.isLoading) return;
		this.isLoading = true;

		if (this.step === 'mfa') {
			const code = this.form.get('mfaCode')?.value;
			if (!this.mfaToken || !code) {
				this.isLoading = false;
				this.form.setErrors({
					...(this.form.errors ?? {}),
					mfaFailed: 'Código MFA é obrigatório',
				});
				return;
			}

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

	async signInWithPasskey() {
		const email = String(this.form.get('email')?.value ?? '').trim();
		if (!email || this.isLoading) {
			this.form.setErrors({
				...(this.form.errors ?? {}),
				passkeyFailed: 'Informe o email para autenticar com passkey.',
			});
			return;
		}

		this.isLoading = true;
		try {
			const options = await firstValueFrom(
				this.authService.beginPasskeyAuthentication(email),
			);
			if (!options) {
				throw new Error('Passkey options not received');
			}

			const assertion = await startAuthentication({
				optionsJSON: options as never,
			});
			const response = await firstValueFrom(
				this.authService.verifyPasskeyAuthentication(
					email,
					assertion as unknown as Record<string, unknown>,
				),
			);

			this.isLoading = false;
			if (!response?.body) {
				throw new Error('Passkey authentication response missing');
			}

			this.handleAuthResult(response.body);
		} catch (error) {
			console.error('Passkey sign-in failed', error);
			this.isLoading = false;
			this.form.setErrors({
				...(this.form.errors ?? {}),
				passkeyFailed: 'Falha ao autenticar com passkey.',
			});
		}
	}
}
