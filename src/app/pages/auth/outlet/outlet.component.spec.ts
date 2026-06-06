import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { OutletComponent } from './outlet.component';

describe('OutletComponent', () => {
	let component: OutletComponent;
	let fixture: ComponentFixture<OutletComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [
				OutletComponent,
				HttpClientTestingModule,
				RouterTestingModule,
			],
		}).compileComponents();

		fixture = TestBed.createComponent(OutletComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should render the aurora scene background', () => {
		const scene = fixture.debugElement.query(By.css('.aurora-scene'));
		expect(scene).toBeTruthy();
	});

	it('should render the auth header', () => {
		const header = fixture.debugElement.query(By.css('.auth-header'));
		expect(header).toBeTruthy();
	});

	it('should render the auth card with glass styling', () => {
		const card = fixture.debugElement.query(By.css('.auth-card'));
		expect(card).toBeTruthy();
	});

	it('should render the back button link', () => {
		const backBtn = fixture.debugElement.query(By.css('.back-btn'));
		expect(backBtn).toBeTruthy();
		expect(backBtn.nativeElement.getAttribute('aria-label')).toBe(
			'Voltar para o início',
		);
	});

	it('should render the logo link centered in header', () => {
		const logoLink = fixture.debugElement.query(By.css('.logo-link'));
		expect(logoLink).toBeTruthy();
		expect(logoLink.nativeElement.getAttribute('aria-label')).toContain(
			'Gatuno',
		);
	});

	it('should render the card glow line decoration', () => {
		const glowLine = fixture.debugElement.query(By.css('.card-glow-line'));
		expect(glowLine).toBeTruthy();
	});

	it('should render the aurora footer', () => {
		const footer = fixture.debugElement.query(By.css('.auth-footer'));
		expect(footer).toBeTruthy();
		expect(footer.nativeElement.textContent).toContain('Gatuno');
	});
});
