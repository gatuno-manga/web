import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeToggleComponent } from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  let component: ThemeToggleComponent;
  let fixture: ComponentFixture<ThemeToggleComponent>;

  const mockThemeService = { toggleTheme: jasmine.createSpy('toggleTheme'), currentTheme: () => 'light' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent, (await import('@angular/common/http/testing')).HttpClientTestingModule],
    })
      .compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    component = fixture.componentInstance;
    (component as any).themeService = mockThemeService;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggleTheme calls themeService.toggleTheme', () => {
    component.toggleTheme();
    expect(mockThemeService.toggleTheme).toHaveBeenCalled();
  });
});
