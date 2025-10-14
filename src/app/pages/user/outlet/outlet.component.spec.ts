import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '@testing/shared-testing.module';

import { OutletComponent } from './outlet.component';

describe('OutletComponent', () => {
  let component: OutletComponent;
  let fixture: ComponentFixture<OutletComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OutletComponent, SharedTestingModule]
    })
      .compileComponents();

    fixture = TestBed.createComponent(OutletComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
