import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocalStorageService } from '@core/services/local-storage.service';
import { SettingsService } from '@core/services/settings.service';
import { ReaderSettingsNotificationComponent } from './reader-settings-notification.component';

describe('ReaderSettingsNotificationComponent', () => {
	let component: ReaderSettingsNotificationComponent;
	let fixture: ComponentFixture<ReaderSettingsNotificationComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [
				ReaderSettingsNotificationComponent,
				HttpClientTestingModule,
			],
			providers: [SettingsService, LocalStorageService],
		}).compileComponents();

		fixture = TestBed.createComponent(ReaderSettingsNotificationComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should respect input parameters', () => {
		fixture.componentRef.setInput('title', 'Configurações Customizadas');
		fixture.componentRef.setInput('subtitle', 'Teste');
		fixture.componentRef.setInput('showResetButton', false);
		fixture.componentRef.setInput('contentType', 'text');

		expect(component.title()).toBe('Configurações Customizadas');
		expect(component.subtitle()).toBe('Teste');
		expect(component.showResetButton()).toBe(false);
		expect(component.contentType()).toBe('text');
	});
});
