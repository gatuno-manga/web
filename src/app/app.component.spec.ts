import { TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '../testing/shared-testing.module';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, SharedTestingModule],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
  it('should render overlay-notification component', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // overlay notification selector should be present
    expect(compiled.querySelector('app-overlay-notification')).toBeTruthy();
  });
});
