import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconButtonComponent } from './icon-button.component';
import { ComponentRef } from '@angular/core';

describe('IconButtonComponent', () => {
	let component: IconButtonComponent;
	let fixture: ComponentFixture<IconButtonComponent>;
    let componentRef: ComponentRef<IconButtonComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IconButtonComponent]
		})
		.compileComponents();

		fixture = TestBed.createComponent(IconButtonComponent);
		component = fixture.componentInstance;
        componentRef = fixture.componentRef;
        componentRef.setInput('name', 'close');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

    it('should render button with ghost variant by default', () => {
        const buttonElement = fixture.nativeElement.querySelector('button');
        expect(buttonElement.classList.contains('ghost')).toBeTrue();
    });

    it('should apply overlay variant when specified', () => {
        componentRef.setInput('variant', 'overlay');
        fixture.detectChanges();
        const buttonElement = fixture.nativeElement.querySelector('button');
        expect(buttonElement.classList.contains('overlay')).toBeTrue();
    });

    it('should pass type correctly', () => {
        componentRef.setInput('type', 'submit');
        fixture.detectChanges();
        const buttonElement = fixture.nativeElement.querySelector('button');
        expect(buttonElement.getAttribute('type')).toBe('submit');
    });

    it('should set disabled state', () => {
        componentRef.setInput('disabled', true);
        fixture.detectChanges();
        const buttonElement = fixture.nativeElement.querySelector('button');
        expect(buttonElement.disabled).toBeTrue();
    });
});
