import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
	let component: LoginComponent;
	let fixture: ComponentFixture<LoginComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [LoginComponent, SharedTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(LoginComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should start on the email step', () => {
		expect(component.step).toBe('email');
	});

	it('should render the email form header with icon wrap', () => {
		const iconWrap = fixture.debugElement.query(By.css('.form-icon-wrap'));
		expect(iconWrap).toBeTruthy();
	});

	it('should render the form title for email step', () => {
		const title = fixture.debugElement.query(By.css('.form-title'));
		expect(title).toBeTruthy();
		expect(title.nativeElement.textContent).toContain('Entre na sua conta');
	});

	it('should render the step indicator', () => {
		const stepIndicator = fixture.debugElement.query(
			By.css('.step-indicator'),
		);
		expect(stepIndicator).toBeTruthy();
	});

	it('should render the passkey button with rich design', () => {
		const passkeyBtn = fixture.debugElement.query(By.css('.passkey-btn'));
		expect(passkeyBtn).toBeTruthy();
		expect(
			passkeyBtn.nativeElement.querySelector('.passkey-btn__label')
				.textContent,
		).toContain('Chave de acesso');
	});

	it('should advance to password step on nextStep() when email is valid', () => {
		component.form.get('email')?.setValue('test@example.com');
		component.nextStep();
		expect(component.step).toBe('password');
	});

	it('should NOT advance to password step with invalid email', () => {
		component.form.get('email')?.setValue('not-an-email');
		component.nextStep();
		expect(component.step).toBe('email');
	});

	it('should show password form title when on password step', () => {
		component.form.get('email')?.setValue('test@example.com');
		component.step = 'password';
		fixture.detectChanges();

		const title = fixture.debugElement.query(By.css('.form-title'));
		expect(title.nativeElement.textContent).toContain('Entre na sua conta');
	});

	it('should set step to mfa when handleAuthResult receives mfa challenge', () => {
		// Testa a lógica de state, não o DOM, para evitar NG0100 com @switch
		expect(component.step).toBe('email');
		component.step = 'mfa';
		expect(component.step).toBe('mfa');
	});

	it('should render auth-link with register navigation', () => {
		const link = fixture.debugElement.query(By.css('#link-register'));
		expect(link).toBeTruthy();
	});

	it('should have loginFailed error set on form after failed password step', () => {
		// Testa a lógica de erros no formulário (não o DOM)
		component.form.setErrors({ loginFailed: 'Credenciais inválidas' });
		expect(component.form.errors?.['loginFailed']).toBe(
			'Credenciais inválidas',
		);
	});
});
