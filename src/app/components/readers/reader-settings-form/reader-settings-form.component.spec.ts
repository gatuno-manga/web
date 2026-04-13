import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReaderSettingsFormComponent } from './reader-settings-form.component';
import { SettingsService } from '../../../service/settings.service';
import { LocalStorageService } from '../../../service/local-storage.service';

describe('ReaderSettingsFormComponent', () => {
	let component: ReaderSettingsFormComponent;
	let fixture: ComponentFixture<ReaderSettingsFormComponent>;
	let settingsService: SettingsService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ReaderSettingsFormComponent, HttpClientTestingModule],
			providers: [SettingsService, LocalStorageService],
		}).compileComponents();

		fixture = TestBed.createComponent(ReaderSettingsFormComponent);
		component = fixture.componentInstance;
		settingsService = TestBed.inject(SettingsService);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should load settings on init', () => {
		const mockSettings = {
			grayScale: true,
			asidePosition: 'left' as const,
			showKeybinds: false,
			showPageNumbers: false,
			brightness: 100,
			contrast: 100,
			invert: 0,
			nightMode: false,
			fontSize: 18,
			fontFamily: 'sans-serif',
			lineHeight: 1.8,
			letterSpacing: 0,
			textAlign: 'justify' as const,
			progressBarPosition: 'top' as const,
		};
		spyOn(settingsService, 'getSettings').and.returnValue(mockSettings);

		component.ngOnInit();

		expect(component.settings).toEqual(mockSettings);
	});

	it('should update gray scale setting', () => {
		spyOn(settingsService, 'toggleGrayScale');
		spyOn(settingsService, 'getSettings').and.returnValue({
			...settingsService.getSettings(),
			grayScale: true,
		});

		component.onGrayScaleChange();

		expect(settingsService.toggleGrayScale).toHaveBeenCalled();
		expect(component.settings.grayScale).toBeTrue();
	});

	it('should update aside position setting', () => {
		spyOn(settingsService, 'setAsidePosition');
		spyOn(settingsService, 'getSettings').and.returnValue({
			...settingsService.getSettings(),
			asidePosition: 'left',
		});

		component.onAsidePositionChange('left');

		expect(settingsService.setAsidePosition).toHaveBeenCalledWith('left');
		expect(component.settings.asidePosition).toBe('left');
	});

	it('should update show page numbers setting', () => {
		spyOn(settingsService, 'toggleShowPageNumbers');
		spyOn(settingsService, 'getSettings').and.returnValue({
			...settingsService.getSettings(),
			showPageNumbers: true,
		});

		component.onShowPageNumbersChange();

		expect(settingsService.toggleShowPageNumbers).toHaveBeenCalled();
		expect(component.settings.showPageNumbers).toBeTrue();
	});

	it('should reset settings', () => {
		spyOn(settingsService, 'resetSettings');
		spyOn(settingsService, 'getSettings').and.returnValue({
			grayScale: false,
			asidePosition: 'right',
			showPageNumbers: true,
			brightness: 100,
			contrast: 100,
			invert: 0,
			nightMode: false,
			fontSize: 18,
			fontFamily: 'sans-serif',
			lineHeight: 1.8,
			letterSpacing: 0,
			textAlign: 'justify',
			progressBarPosition: 'top',
		});

		component.resetSettings();

		expect(settingsService.resetSettings).toHaveBeenCalled();
		expect(component.settings.grayScale).toBeFalse();
	});

	it('should set initial view filter based on content type', () => {
		component.contentType = 'text';
		component.ngOnInit();
		expect(component.viewFilter).toBe('text');

		component.contentType = 'all';
		component.ngOnInit();
		expect(component.viewFilter).toBe('all');
	});

	it('should update view filter', () => {
		component.setView('pages');
		expect(component.viewFilter).toBe('pages');
	});
});
