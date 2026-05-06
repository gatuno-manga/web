import { TestBed } from '@angular/core/testing';
import { CookieService as AppCookieService } from './cookie.service';
import { CookieService as NgxCookieService } from 'ngx-cookie-service';

describe('CookieService', () => {
    let service: AppCookieService;
    const mockNgx = { set: jasmine.createSpy('set'), get: jasmine.createSpy('get').and.returnValue('v'), delete: jasmine.createSpy('delete') } as any;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                { provide: NgxCookieService, useValue: mockNgx },
            ]
        });
        service = TestBed.inject(AppCookieService);
    });

    it('should set cookie with prefix', () => {
        service.set('k1', 'v1');
        expect(mockNgx.set).toHaveBeenCalled();
    });

    it('should get cookie with prefix', () => {
        mockNgx.get.and.returnValue('vx');
        expect(service.get('k1')).toBe('vx');
    });

    it('should delete cookie', () => {
        service.delete('k1');
        expect(mockNgx.delete).toHaveBeenCalled();
    });
});
