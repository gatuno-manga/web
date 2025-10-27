import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { LocalStorageService } from './local-storage.service';
import { DEFAULT_SETTINGS } from '../models/settings.models';

describe('SettingsService', () => {
    let service: SettingsService;
    let localStorageService: jasmine.SpyObj<LocalStorageService>;

    beforeEach(() => {
        const localStorageSpy = jasmine.createSpyObj('LocalStorageService', ['get', 'set']);
        localStorageSpy.get.and.returnValue(null);

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

    it('should initialize with DEFAULT_SETTINGS when no saved settings', () => {
        expect(service.getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('should update settings and persist to local storage', () => {
        const newPartial = { showPageNumbers: false };
        service.updateSettings(newPartial);
        expect(service.getSettings().showPageNumbers).toBeFalse();
        expect(localStorageService.set).toHaveBeenCalledWith('reader-settings', jasmine.any(String));
    });
});
