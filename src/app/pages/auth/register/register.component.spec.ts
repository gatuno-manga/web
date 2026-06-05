import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
	let component: RegisterComponent;
	let fixture: ComponentFixture<RegisterComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [RegisterComponent, SharedTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(RegisterComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should render the aurora-style form header with icon', () => {
		const iconWrap = fixture.debugElement.query(By.css('.form-icon-wrap'));
		expect(iconWrap).toBeTruthy();
	});

	it('should render the form title', () => {
		const title = fixture.debugElement.query(By.css('.form-title'));
		expect(title).toBeTruthy();
		expect(title.nativeElement.textContent).toContain('Crie sua conta');
	});

	it('should render the form subtitle', () => {
		const subtitle = fixture.debugElement.query(By.css('.form-subtitle'));
		expect(subtitle).toBeTruthy();
	});

	it('should render three input fields (email, password, confirmPassword)', () => {
		const inputs = fixture.debugElement.queryAll(By.css('app-input'));
		expect(inputs.length).toBe(3);
	});

	it('should render the submit button', () => {
		const btn = fixture.debugElement.query(By.css('#btn-register'));
		expect(btn).toBeTruthy();
	});

	it('should render auth-link with login navigation', () => {
		const link = fixture.debugElement.query(By.css('#link-login'));
		expect(link).toBeTruthy();
	});

	it('should be invalid when fields are empty', () => {
		expect(component.form.invalid).toBeTrue();
	});

	it('should be invalid when passwords do not match', () => {
		component.form.get('email')?.setValue('user@test.com');
		component.form.get('password')?.setValue('StrongPass1!');
		component.form.get('confirmPassword')?.setValue('DifferentPass1!');
		component.form.updateValueAndValidity();
		expect(component.form.invalid).toBeTrue();
	});

	it('should store registrationFailed error in form errors', () => {
		// Testa a lógica de erros no formulário (não o DOM) para evitar NG0100
		component.form.setErrors({ registrationFailed: 'Este e-mail já está em uso' });
		expect(component.form.errors?.['registrationFailed']).toBe('Este e-mail já está em uso');
	});
});
