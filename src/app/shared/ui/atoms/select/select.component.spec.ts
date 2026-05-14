import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '@testing/shared-testing.module';

import { SelectCycleComponent } from './select-cycle.component';

describe('SelectCycleComponent', () => {
	let component: SelectCycleComponent;
	let fixture: ComponentFixture<SelectCycleComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SelectCycleComponent, SharedTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(SelectCycleComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('items', [
			{ label: 'a', checked: jasmine.createSpy('a') },
			{ label: 'b', checked: jasmine.createSpy('b') },
		]);
		fixture.componentRef.setInput('select', 0);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('onSelect calls checked of next item', () => {
		component.onSelect();
		expect(component.items()[1].checked).toHaveBeenCalled();
	});
});
