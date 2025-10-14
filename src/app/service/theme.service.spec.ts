import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { RendererFactory2 } from '@angular/core';

describe('ThemeService', () => {
    let service: ThemeService;
    const mockRendererFactory = { createRenderer: () => ({ setAttribute: jasmine.createSpy('setAttribute') }) } as any;
    const mockCookie = { set: jasmine.createSpy('set') } as any;
    const mockLocal = { set: jasmine.createSpy('set') } as any;

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

    it('toggleTheme should flip currentTheme', () => {
        const before = service.currentTheme();
        service.toggleTheme();
        const after = service.currentTheme();
        expect(after).not.toBe(before);
    });

    it('setThemeFromServer should set theme in non-browser', () => {
        service.setThemeFromServer('dark');
        expect(service.currentTheme()).toBe('dark');
    });
});
