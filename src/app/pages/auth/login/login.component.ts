import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { authService } from '../../../service/auth.service';
import { PasswordInputComponent, TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent } from '../../../components/inputs/button/button.component';

@Component({
  selector: 'app-login',
  imports: [TextInputComponent,
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
  constructor(
    private fb: FormBuilder,
    private readonly authService: authService,
    private readonly router: Router
  ) {
    this.form = this.fb.group({
      email: [''],
      password: [''],
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.authService.login(this.form.value).subscribe({
      next: (response) => {
        console.log('Login successful', response);
        this.router.navigate(['/books']);
      },
      error: (error) => {
        console.error('Login failed', error);
      }
    });
  }
}
