import { Location } from '@angular/common';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { ThemeService } from '@core/services/theme.service';
import { UserService } from '@core/services/user.service';
import { UserTokenService } from '@core/services/user-token.service';
import { of } from 'rxjs';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
	let component: HeaderComponent;
	let fixture: ComponentFixture<HeaderComponent>;
	const mockLocation = { back: jasmine.createSpy('back') };
	const mockThemeService = {
		currentTheme: signal('dark'),
		hasUserSelectedTheme: signal(true),
	};
	const mockUserTokenService = {
		hasValidAccessToken: true,
		isAdmin: true,
		hasValidAccessTokenSignal: signal(true),
		isAdminSignal: signal(true),
	};
	const mockUserService = {
		profileSignal: signal({ profileImageUrl: 'test-url' }),
	};
	const mockBookService = {
		getBooks: jasmine
			.createSpy('getBooks')
			.and.returnValue(of({ data: [] })),
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
				{ provide: UserService, useValue: mockUserService },
				{ provide: BookService, useValue: mockBookService },
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

	it('should display user avatar when profileImageUrl is present', () => {
		const avatar = fixture.nativeElement.querySelector('.avatar');
		expect(avatar).toBeTruthy();
		expect(avatar.src).toContain('test-url');
	});
});
