import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  const mockLocation = { back: jasmine.createSpy('back') };
  const mockThemeService = { currentTheme: () => 'dark' };
  const mockUserToken = { hasToken: true, isAdmin: () => true };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, (await import('@angular/common/http/testing')).HttpClientTestingModule, (await import('@angular/router/testing')).RouterTestingModule],
      providers: [
        { provide: Location, useValue: mockLocation }
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
    // access private injected services via casting to any (component uses DI directly)
    (component as any).themeService = { currentTheme: () => 'dark' };
    (component as any).userTokenService = { hasToken: true, isAdmin: () => true };

    expect(component.isDarkTheme()).toBeTrue();
    expect(component.isloggedIn()).toBeTrue();
    expect(component.isAdmin()).toBeTrue();
  });
});
