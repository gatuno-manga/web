import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReaderSettingsNotificationComponent } from './reader-settings-notification.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SettingsService } from '../../../../service/settings.service';
import { LocalStorageService } from '../../../../service/local-storage.service';

describe('ReaderSettingsNotificationComponent', () => {
    let component: ReaderSettingsNotificationComponent;
    let fixture: ComponentFixture<ReaderSettingsNotificationComponent>;
    let settingsService: SettingsService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ReaderSettingsNotificationComponent, HttpClientTestingModule],
            providers: [SettingsService, LocalStorageService]
        }).compileComponents();

        fixture = TestBed.createComponent(ReaderSettingsNotificationComponent);
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
            showPageNumbers: false
        };
        spyOn(settingsService, 'getSettings').and.returnValue(mockSettings);

        component.ngOnInit();

        expect(component.settings).toEqual(mockSettings);
    });

    it('should update gray scale setting', () => {
        spyOn(settingsService, 'updateSettings');
        component.settings.grayScale = false;

        component.onGrayScaleChange();

        expect(settingsService.updateSettings).toHaveBeenCalledWith({ grayScale: true });
    });

    it('should update aside position setting', () => {
        spyOn(settingsService, 'updateSettings');
        component.settings.asidePosition = 'left';

        component.onAsidePositionChange('left');

        expect(settingsService.updateSettings).toHaveBeenCalledWith({ asidePosition: 'left' });
    });


    it('should update show page numbers setting', () => {
        spyOn(settingsService, 'updateSettings');
        component.settings.showPageNumbers = false;

        component.onShowPageNumbersChange();

        expect(settingsService.updateSettings).toHaveBeenCalledWith({ showPageNumbers: true });
    });

    it('should reset settings', () => {
        spyOn(settingsService, 'resetSettings');
        spyOn(settingsService, 'getSettings').and.returnValue({
            grayScale: false,
            asidePosition: 'right',
            showPageNumbers: true
        });

        component.resetSettings();

        expect(settingsService.resetSettings).toHaveBeenCalled();
    });

    it('should respect input parameters', () => {
        component.title = 'Configurações Customizadas';
        component.subtitle = 'Teste';
        component.showResetButton = false;

        expect(component.title).toBe('Configurações Customizadas');
        expect(component.subtitle).toBe('Teste');
        expect(component.showResetButton).toBe(false);
    });
});
