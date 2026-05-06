import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressNotificationComponent } from './progress-notification.component';

describe('ProgressNotificationComponent', () => {
	let component: ProgressNotificationComponent;
	let fixture: ComponentFixture<ProgressNotificationComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ProgressNotificationComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(ProgressNotificationComponent);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	it('should display default title', () => {
		fixture.detectChanges();
		const compiled = fixture.nativeElement;
		expect(compiled.querySelector('h3')?.textContent).toBe('Processando');
	});

	it('should display progress percentage', () => {
		fixture.componentRef.setInput('progress', 50);
		fixture.detectChanges();
		const compiled = fixture.nativeElement;
		expect(compiled.querySelector('.percentage')?.textContent).toContain(
			'50',
		);
	});

	it('should update progress bar width', () => {
		fixture.componentRef.setInput('progress', 75);
		fixture.detectChanges();
		const progressFill =
			fixture.nativeElement.querySelector('.progress-fill');
		expect(progressFill?.style.width).toBe('75%');
	});

	it('should display status message', () => {
		fixture.componentRef.setInput('statusMessage', 'Teste de status');
		fixture.detectChanges();
		const compiled = fixture.nativeElement;
		expect(compiled.querySelector('.status')?.textContent).toBe(
			'Teste de status',
		);
	});

	it('should display current item when provided', () => {
		fixture.componentRef.setInput('currentItem', 'arquivo.txt');
		fixture.detectChanges();
		const compiled = fixture.nativeElement;
		expect(compiled.querySelector('.current-item')).toBeTruthy();
		expect(
			compiled.querySelector('.current-item strong')?.textContent,
		).toBe('arquivo.txt');
	});

	it('should not display current item when not provided', () => {
		fixture.componentRef.setInput('currentItem', undefined);
		fixture.detectChanges();
		const compiled = fixture.nativeElement;
		expect(compiled.querySelector('.current-item')).toBeFalsy();
	});

	it('should accept custom title', () => {
		fixture.componentRef.setInput('title', 'Upload em progresso');
		fixture.detectChanges();
		const compiled = fixture.nativeElement;
		expect(compiled.querySelector('h3')?.textContent).toBe(
			'Upload em progresso',
		);
	});
});
