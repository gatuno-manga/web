import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { signal } from '@angular/core';

import { DefaultOutletComponent } from './default-outlet.component';
import { HeaderStateService } from '../../../service/header-state.service';

describe('DefaultOutletComponent', () => {
	let component: DefaultOutletComponent;
	let fixture: ComponentFixture<DefaultOutletComponent>;

	const mockHeaderState = {
		isFixedSignal: signal(false),
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DefaultOutletComponent, SharedTestingModule],
			providers: [
				{ provide: HeaderStateService, useValue: mockHeaderState },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(DefaultOutletComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should open side nav', () => {
		component.openSideNav();
		expect(component.sidebarOpen()).toBeTrue();
	});
});
