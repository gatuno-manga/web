import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { LocalStorageService } from './local-storage.service';
import { DEFAULT_SETTINGS } from '../models/settings.models';

describe('SettingsService', () => {
	let service: SettingsService;
	let localStorageService: jasmine.SpyObj<LocalStorageService>;

	beforeEach(() => {
		const localStorageSpy = jasmine.createSpyObj('LocalStorageService', [
			'get',
			'set',
		]);
		localStorageSpy.get.and.returnValue(null);

		TestBed.configureTestingModule({
			providers: [
				SettingsService,
				{ provide: LocalStorageService, useValue: localStorageSpy },
			],
		});

		service = TestBed.inject(SettingsService);
		localStorageService = TestBed.inject(
			LocalStorageService,
		) as jasmine.SpyObj<LocalStorageService>;
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
		expect(localStorageService.set).toHaveBeenCalledWith(
			'reader-settings',
			jasmine.any(String),
		);
	});

	it('should update line height independently', () => {
		const defaultLetterSpacing = service.getSettings().letterSpacing;

		service.setLineHeight(2.2);

		expect(service.getSettings().lineHeight).toBe(2.2);
		expect(service.getSettings().letterSpacing).toBe(defaultLetterSpacing);
	});

	it('should clamp line height limits', () => {
		service.setLineHeight(10);
		expect(service.getSettings().lineHeight).toBe(3);

		service.setLineHeight(0.1);
		expect(service.getSettings().lineHeight).toBe(1);
	});

	it('should update letter spacing independently', () => {
		const defaultLineHeight = service.getSettings().lineHeight;

		service.setLetterSpacing(1.7);

		expect(service.getSettings().letterSpacing).toBe(1.7);
		expect(service.getSettings().lineHeight).toBe(defaultLineHeight);
	});

	it('should clamp letter spacing limits', () => {
		service.setLetterSpacing(50);
		expect(service.getSettings().letterSpacing).toBe(10);

		service.setLetterSpacing(-5);
		expect(service.getSettings().letterSpacing).toBe(-2);
	});
});
