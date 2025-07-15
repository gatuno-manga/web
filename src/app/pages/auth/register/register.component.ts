import { Component } from '@angular/core';
import { PasswordInputComponent, TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../../../service/auth.service';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent } from '../../../components/inputs/button/button.component';

@Component({
  selector: 'app-register',
  imports: [TextInputComponent,
    PasswordInputComponent,
    ButtonComponent,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  form: FormGroup;
  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.form = this.fb.nonNullable.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: [this.passwordsMatch] }
    );
  }

  private passwordsMatch(control: AbstractControl): { [key: string]: string | boolean } | null {
    const group = control as FormGroup;
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (password !== confirmPassword) {
      group.get('confirmPassword')?.setErrors({ customError: 'As senhas não são iguais' });
      return { customError: 'As senhas não são iguais' };
    }
    return null;
  }

  submit() {
    if (this.form.invalid) return;
    const data = {
      email: this.form.get('email')?.value,
      password: this.form.get('password')?.value,
    }
    this.authService.register(data).subscribe({
      next: (response) => {
        console.log('Registration successful', response);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Registration failed', error);
      }
    });
  }
}
