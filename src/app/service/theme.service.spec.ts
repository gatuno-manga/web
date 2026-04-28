import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { RendererFactory2 } from '@angular/core';

describe('ThemeService', () => {
    let service: ThemeService;
    const mockRendererFactory = { createRenderer: () => ({ setAttribute: jasmine.createSpy('setAttribute') }) } as any;
    const mockCookie = { set: jasmine.createSpy('set') } as any;
    const mockLocal = { 
        set: jasmine.createSpy('set'),
        get: jasmine.createSpy('get')
    } as any;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                { provide: RendererFactory2, useValue: mockRendererFactory },
            ]
        });

        // construct service with PLATFORM_ID mocked to server so effects don't run
        service = new ThemeService('server' as any, mockRendererFactory as any, mockCookie as any, mockLocal as any);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('setTheme should change currentTheme and set hasUserSelectedTheme', () => {
        service.setTheme('true-dark');
        expect(service.currentTheme()).toBe('true-dark');
        expect(service.hasUserSelectedTheme()).toBeTrue();
    });

    it('setThemeFromServer should set theme in non-browser', () => {
        service.setThemeFromServer('true-dark');
        expect(service.currentTheme()).toBe('true-dark');
    });

    it('should initialize hasUserSelectedTheme as false in browser if no theme is saved', () => {
        mockLocal.get.and.returnValue(null);
        TestBed.runInInjectionContext(() => {
            const browserService = new ThemeService('browser' as any, mockRendererFactory as any, mockCookie as any, mockLocal as any);
            expect(browserService.hasUserSelectedTheme()).toBeFalse();
        });
    });
});
