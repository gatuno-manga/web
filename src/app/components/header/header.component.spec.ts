import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';

import { HeaderComponent } from './header.component';
import { ThemeService } from '../../service/theme.service';
import { UserTokenService } from '../../service/user-token.service';
import { signal } from '@angular/core';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  const mockLocation = { back: jasmine.createSpy('back') };
  const mockThemeService = { currentTheme: () => 'dark' };
  const mockUserTokenService = {
    hasValidAccessToken: true,
    isAdmin: true,
    hasValidAccessTokenSignal: signal(true),
    isAdminSignal: signal(true)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, (await import('@angular/common/http/testing')).HttpClientTestingModule, (await import('@angular/router/testing')).RouterTestingModule],
      providers: [
        { provide: Location, useValue: mockLocation },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: UserTokenService, useValue: mockUserTokenService }
      ]
    })
      .compileComponents();

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

  it('isDarkTheme/isloggedIn/isAdmin rely on services', () => {
    expect(component.isDarkTheme()).toBeTrue();
    expect(component.isloggedIn()).toBeTrue();
    expect(component.isAdmin()).toBeTrue();
  });
});
