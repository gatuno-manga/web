import { Component, DebugElement } from '@angular/core';
import {
	ComponentFixture,
	fakeAsync,
	TestBed,
	tick,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TooltipDirective } from './tooltip.directive';

@Component({
	template: `<button [appTooltip]="'Test Tooltip'">Test</button>`,
	imports: [TooltipDirective],
})
class TestComponent {}

describe('TooltipDirective', () => {
	let fixture: ComponentFixture<TestComponent>;
	let buttonEl: DebugElement;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [TestComponent, TooltipDirective],
		});
		fixture = TestBed.createComponent(TestComponent);
		buttonEl = fixture.debugElement.query(By.css('button'));
		fixture.detectChanges();
	});

	afterEach(() => {
		// Cleanup created tooltips
		const tooltip = document.querySelector('.gatuno-custom-tooltip');
		if (tooltip) {
			tooltip.remove();
		}
	});

	it('should create an instance', () => {
		const directive = buttonEl.injector.get(TooltipDirective);
		expect(directive).toBeTruthy();
	});

	it('should show tooltip on mouseenter', fakeAsync(() => {
		buttonEl.triggerEventHandler('mouseenter', null);
		tick(200); // Wait for timeout
		fixture.detectChanges();

		const tooltip = document.querySelector('.gatuno-custom-tooltip');
		expect(tooltip).toBeTruthy();
		expect(tooltip?.textContent?.trim()).toBe('Test Tooltip');

		// Flush remaining timers
		buttonEl.triggerEventHandler('mouseleave', null);
		tick(200);
	}));
});
