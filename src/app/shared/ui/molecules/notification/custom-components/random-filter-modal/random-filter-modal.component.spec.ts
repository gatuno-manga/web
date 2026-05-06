import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RandomFilterModalComponent, RandomFilterResult } from './random-filter-modal.component';

describe('RandomFilterModalComponent', () => {
    let component: RandomFilterModalComponent;
    let fixture: ComponentFixture<RandomFilterModalComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RandomFilterModalComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RandomFilterModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
        expect(component.randomizeTags()).toBeTrue();
        expect(component.randomizeTypes()).toBeFalse();
        expect(component.randomizeSensitive()).toBeFalse();
    });

    it('should toggle randomizeTags signal', () => {
        component.randomizeTags.set(false);
        expect(component.randomizeTags()).toBeFalse();

        component.randomizeTags.set(true);
        expect(component.randomizeTags()).toBeTrue();
    });

    it('should toggle randomizeTypes signal', () => {
        component.randomizeTypes.set(true);
        expect(component.randomizeTypes()).toBeTrue();

        component.randomizeTypes.set(false);
        expect(component.randomizeTypes()).toBeFalse();
    });

    it('should toggle randomizeSensitive signal', () => {
        component.randomizeSensitive.set(true);
        expect(component.randomizeSensitive()).toBeTrue();

        component.randomizeSensitive.set(false);
        expect(component.randomizeSensitive()).toBeFalse();
    });

    it('should call close with result on confirm', () => {
        const closeSpy = jasmine.createSpy('close');
        component.close = closeSpy;

        component.randomizeTags.set(true);
        component.randomizeTypes.set(false);
        component.randomizeSensitive.set(true);

        component.confirm();

        expect(closeSpy).toHaveBeenCalledWith({
            tags: true,
            types: false,
            sensitive: true
        } as RandomFilterResult);
    });

    it('should call close with null on cancel', () => {
        const closeSpy = jasmine.createSpy('close');
        component.close = closeSpy;

        component.cancel();

        expect(closeSpy).toHaveBeenCalledWith(null);
    });

    it('should not throw if close is not defined on confirm', () => {
        component.close = undefined as any;

        expect(() => component.confirm()).not.toThrow();
    });

    it('should not throw if close is not defined on cancel', () => {
        component.close = undefined as any;

        expect(() => component.cancel()).not.toThrow();
    });
});
