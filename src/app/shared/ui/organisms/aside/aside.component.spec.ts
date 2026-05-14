import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsideComponent } from './aside.component';

describe('AsideComponent', () => {
	let component: AsideComponent;
	let fixture: ComponentFixture<AsideComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [
				AsideComponent,
				(await import('@angular/common/http/testing'))
					.HttpClientTestingModule,
			],
			providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
		}).compileComponents();

		fixture = TestBed.createComponent(AsideComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('toggle/open/close should change isOpen', () => {
		component.isOpen.set(false);
		component.toggle();
		expect(component.isOpen()).toBeTrue();
		component.close();
		expect(component.isOpen()).toBeFalse();
		component.open();
		expect(component.isOpen()).toBeTrue();
	});

	it('getDragTransform returns correct values for closed/open and direction', () => {
		fixture.componentRef.setInput('position', 'right');
		(component as any).isDragging.set(false);
		component.isOpen.set(false);
		expect(component.dragTransform()).toBe('translateX(100%)');

		component.isOpen.set(true);
		expect(component.dragTransform()).toBe('translateX(0)');
	});

	it('handleKeyboardEvent with ctrl/meta + b toggles', () => {
		component.isOpen.set(false);
		const ev = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true });
		component.handleKeyboardEvent(ev as KeyboardEvent);
		expect(component.isOpen()).toBeTrue();
	});
});
