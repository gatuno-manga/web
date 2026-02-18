import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { HeaderComponent } from './header.component';
import { ThemeService } from '../../service/theme.service';
import { UserTokenService } from '../../service/user-token.service';

describe('HeaderComponent', () => {
	let component: HeaderComponent;
	let fixture: ComponentFixture<HeaderComponent>;
	const mockLocation = { back: jasmine.createSpy('back') };
	const mockThemeService = { currentTheme: signal('dark') };
	const mockUserTokenService = {
		hasValidAccessToken: true,
		isAdmin: true,
		hasValidAccessTokenSignal: signal(true),
		isAdminSignal: signal(true),
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [HeaderComponent],
			providers: [
				provideRouter([]),
				provideHttpClientTesting(),
				{ provide: Location, useValue: mockLocation },
				{ provide: ThemeService, useValue: mockThemeService },
				{ provide: UserTokenService, useValue: mockUserTokenService },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(HeaderComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('backPage should call location.back', () => {
		component.backPage();
		expect(mockLocation.back).toHaveBeenCalled();
	});

	it('isDarkTheme/isLoggedIn/isAdmin rely on services', () => {
		expect(component.isDarkTheme()).toBeTrue();
		expect(component.isLoggedIn()).toBeTrue();
		expect(component.isAdmin()).toBeTrue();
	});
});
