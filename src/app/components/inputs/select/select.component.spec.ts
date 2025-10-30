import { ElementRef } from '@angular/core';
import { SelectComponent } from './select.component';

describe('SelectComponent (smoke)', () => {
    it('should be instantiable', () => {
        const host = { nativeElement: document.createElement('div') } as ElementRef<HTMLElement>;
        const c = new SelectComponent(host);
        expect(c).toBeTruthy();
    });
});
