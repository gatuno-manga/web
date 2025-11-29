import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { SharedTestingModule } from '../../../testing/shared-testing.module';
import { IconRegistryService } from '@service/icon-registry.service';

import { IconsComponent } from './icons.component';

describe('IconsComponent', () => {
  let component: IconsComponent;
  let fixture: ComponentFixture<IconsComponent>;
  const mockIconRegistry = {
    getIcon: jasmine.createSpy('getIcon').and.returnValue(of('<svg></svg>'))
  };
  const mockSanitizer = {
    bypassSecurityTrustHtml: (v: any) => v,
    sanitize: jasmine.createSpy('sanitize').and.returnValue('')
  } as any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconsComponent, SharedTestingModule],
      providers: [
        { provide: DomSanitizer, useValue: mockSanitizer },
        { provide: IconRegistryService, useValue: mockIconRegistry }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(IconsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default values for inputs', () => {
    expect(component.size()).toBe('24px');
    expect(component.color()).toBe('currentColor');
    expect(component.stroke()).toBe('1');
    expect(component.background()).toBe('none');
  });
});
