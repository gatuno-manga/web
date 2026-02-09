import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '@testing/shared-testing.module';

import { DefaultOutletComponent } from './default-outlet.component';

describe('DefaultOutletComponent', () => {
	let component: DefaultOutletComponent;
	let fixture: ComponentFixture<DefaultOutletComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DefaultOutletComponent, SharedTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(DefaultOutletComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
