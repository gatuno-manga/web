import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../service/auth.service';
import { PasswordInputComponent, TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonComponent } from '../../../components/inputs/button/button.component';

@Component({
  selector: 'app-login',
  imports: [
    TextInputComponent,
    ButtonComponent,
    ReactiveFormsModule,
    RouterModule,
    PasswordInputComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  form: FormGroup;
  private returnUrl: string = '/books';

  constructor(
    private fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      email: [''],
      password: [''],
    });
    // Captura a URL de retorno dos query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/books';
  }

  submit() {
    if (this.form.invalid) return;
    this.authService.login(this.form.value).subscribe({
      next: (response) => {
        console.log('Login successful', response);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        console.error('Login failed', error);
        this.form.setErrors({ loginFailed: 'Email ou senha inválidos' });
      }
    });
  }
}
