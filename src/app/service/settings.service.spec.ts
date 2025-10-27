import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { LocalStorageService } from './local-storage.service';
import { DEFAULT_SETTINGS } from '../models/settings.models';

describe('SettingsService', () => {
    let service: SettingsService;
    let localStorageService: jasmine.SpyObj<LocalStorageService>;

    beforeEach(() => {
        const localStorageSpy = jasmine.createSpyObj('LocalStorageService', ['get', 'set']);

        TestBed.configureTestingModule({
            providers: [
                SettingsService,
                { provide: LocalStorageService, useValue: localStorageSpy }
            ]
        });

        service = TestBed.inject(SettingsService);
        localStorageService = TestBed.inject(LocalStorageService) as jasmine.SpyObj<LocalStorageService>;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should load default settings when no saved settings exist', () => {
        localStorageService.get.and.returnValue(null);
        const settings = service.getSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should update settings and save to localStorage', () => {
        const newSettings = { grayScale: true };
        service.updateSettings(newSettings);

        const currentSettings = service.getSettings();
        expect(currentSettings.grayScale).toBe(true);
        expect(localStorageService.set).toHaveBeenCalled();
    });

    it('should toggle gray scale', () => {
        const initialGrayScale = service.getSettings().grayScale;
        service.toggleGrayScale();
        expect(service.getSettings().grayScale).toBe(!initialGrayScale);
    });

    it('should toggle show keybinds', () => {
        const initialShowKeybinds = service.getSettings().showKeybinds;
        service.toggleShowKeybinds();
        expect(service.getSettings().showKeybinds).toBe(!initialShowKeybinds);
    });

    it('should toggle show page numbers', () => {
        const initialShowPageNumbers = service.getSettings().showPageNumbers;
        service.toggleShowPageNumbers();
        expect(service.getSettings().showPageNumbers).toBe(!initialShowPageNumbers);
    });

    it('should set aside position', () => {
        service.setAsidePosition('left');
        expect(service.getSettings().asidePosition).toBe('left');

        service.setAsidePosition('right');
        expect(service.getSettings().asidePosition).toBe('right');
    });

    it('should reset settings to default', () => {
        service.updateSettings({ grayScale: true, asidePosition: 'left' });
        service.resetSettings();
        expect(service.getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('should emit settings changes through observable', (done) => {
        service.settings$.subscribe(settings => {
            if (settings.grayScale) {
                expect(settings.grayScale).toBe(true);
                done();
            }
        });

        service.updateSettings({ grayScale: true });
    });
});
