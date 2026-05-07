import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SelectComponent } from './select.component';

describe('SelectComponent (smoke)', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SelectComponent],
            providers: [
                {
                    provide: ElementRef,
                    useValue: { nativeElement: document.createElement('div') }
                }
            ]
        }).compileComponents();
    });

    it('should be instantiable', () => {
        const fixture = TestBed.createComponent(SelectComponent);
        const component = fixture.componentInstance;
        expect(component).toBeTruthy();
    });
});
