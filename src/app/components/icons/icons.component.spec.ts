import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { SharedTestingModule } from '../../../testing/shared-testing.module';

import { IconsComponent } from './icons.component';

describe('IconsComponent', () => {
  let component: IconsComponent;
  let fixture: ComponentFixture<IconsComponent>;
  const mockHttp = { get: jasmine.createSpy('get').and.returnValue(of('<svg></svg>')) };
  const mockSanitizer = { bypassSecurityTrustHtml: (v: any) => v } as any;
  const mockCdr = { markForCheck: jasmine.createSpy('markForCheck') };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconsComponent, SharedTestingModule],
      providers: [
        { provide: DomSanitizer, useValue: mockSanitizer }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(IconsComponent);
    component = fixture.componentInstance;
    // set inputs
    component.name = 'test-icon';
    (component as any).http = mockHttp; // override actual http used in component runtime
    (component as any).sanitizer = mockSanitizer;
    (component as any).cdr = mockCdr;
    fixture.detectChanges();
  });

  it('should create and load svg on changes', () => {
    component.ngOnChanges({} as any);
    expect(mockHttp.get).toHaveBeenCalled();
    expect((component as any).svgContent).toBe('<svg></svg>');
  });
});
