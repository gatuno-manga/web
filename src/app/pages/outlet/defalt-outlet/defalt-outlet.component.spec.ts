import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '@testing/shared-testing.module';

import { DefaltOutletComponent } from './defalt-outlet.component';

describe('DefaltOutletComponent', () => {
  let component: DefaltOutletComponent;
  let fixture: ComponentFixture<DefaltOutletComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefaltOutletComponent, SharedTestingModule]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DefaltOutletComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
