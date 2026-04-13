import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReaderSettingsNotificationComponent } from './reader-settings-notification.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SettingsService } from '../../../../service/settings.service';
import { LocalStorageService } from '../../../../service/local-storage.service';

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
		component.title = 'Configurações Customizadas';
		component.subtitle = 'Teste';
		component.showResetButton = false;
		component.contentType = 'text';

		expect(component.title).toBe('Configurações Customizadas');
		expect(component.subtitle).toBe('Teste');
		expect(component.showResetButton).toBe(false);
		expect(component.contentType).toBe('text');
	});
});
