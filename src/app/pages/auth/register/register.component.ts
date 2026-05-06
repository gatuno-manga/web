import { Component } from '@angular/core';
import {
	PasswordInputComponent,
	TextInputComponent,
} from '@ui/atoms/inputs/text-input/text-input.component';
import {
	FormBuilder,
	FormGroup,
	ReactiveFormsModule,
	Validators,
	AbstractControl,
} from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { minUppercaseValidator } from '@shared/validators/min-uppercase.validator';
import { minNumberValidator } from '@shared/validators/min-number.validator';
import { minSymbolValidator } from '@shared/validators/min-symbol.validator';
import { MetaDataService } from '@core/services/meta-data.service';

@Component({
	selector: 'app-register',
	imports: [
		TextInputComponent,
		PasswordInputComponent,
		ButtonComponent,
		ReactiveFormsModule,
		RouterModule,
	],
	templateUrl: './register.component.html',
	styleUrl: './register.component.scss',
})
export class RegisterComponent {
	form: FormGroup;
	constructor(
		private readonly fb: FormBuilder,
		private readonly authService: AuthService,
		private readonly router: Router,
		private readonly metaService: MetaDataService,
	) {
		this.form = this.fb.nonNullable.group(
			{
				email: ['', [Validators.required, Validators.email]],
				password: [
					'',
					[
						Validators.required,
						Validators.minLength(8),
						minUppercaseValidator(1),
						minNumberValidator(1),
						minSymbolValidator(1),
					],
				],
				confirmPassword: ['', [Validators.required]],
			},
			{ validators: [this.passwordsMatch] },
		);
		this.setMetaData();
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Registrar-se',
			description: 'Crie sua conta para acessar conteúdos.',
		});
	}

	private passwordsMatch(
		control: AbstractControl,
	): { [key: string]: string | boolean } | null {
		const group = control as FormGroup;
		const password = group.get('password')?.value;
		const confirmPassword = group.get('confirmPassword')?.value;
		if (password !== confirmPassword) {
			group
				.get('confirmPassword')
				?.setErrors({ customError: 'As senhas não são iguais' });
			return { customError: 'As senhas não são iguais' };
		}
		return null;
	}

	submit() {
		if (this.form.invalid) return;
		const data = {
			email: this.form.get('email')?.value,
			password: this.form.get('password')?.value,
		};
		this.authService.register(data).subscribe({
			next: (response) => {
				this.router.navigate(['/home']);
			},
			error: (error) => {
				const message = error.error?.message;

				if (message === 'User already exists') {
					this.form.get('email')?.setErrors({
						customError: 'Este e-mail já está em uso.',
					});
				} else if (Array.isArray(message)) {
					// Se for um erro de validação (DTO do NestJS), exibe a primeira mensagem no topo
					this.form.setErrors({ registrationFailed: message[0] });
				} else {
					this.form.setErrors({
						registrationFailed:
							message || 'Falha ao registrar. Tente novamente.',
					});
				}

				console.error('Registration error:', error);
			},
		});
	}
}
