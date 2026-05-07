import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
    let service: LocalStorageService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(LocalStorageService);
        // clear localStorage for tests
        (globalThis as any).localStorage.clear();
    });

    it('should set and get value', () => {
        service.set('k1', 'v1');
        expect(service.get('k1')).toBe('v1');
        expect(service.has('k1')).toBeTrue();
    });

    it('should delete and clear', () => {
        service.set('k2', 'v2');
        expect(service.get('k2')).toBe('v2');
        service.delete('k2');
        expect(service.get('k2')).toBeNull();

        service.set('k3', 'v3');
        service.clear();
        expect(service.keys().length).toBe(0);
    });
});
