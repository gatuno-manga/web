import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SideNavComponent } from './side-nav.component';

describe('SideNavComponent', () => {
	let component: SideNavComponent;
	let fixture: ComponentFixture<SideNavComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SideNavComponent],
			providers: [provideRouter([]), provideHttpClientTesting()],
		}).compileComponents();

		fixture = TestBed.createComponent(SideNavComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should emit close when onClose is called', () => {
		spyOn(component.close, 'emit');
		component.onClose();
		expect(component.close.emit).toHaveBeenCalled();
	});
});
