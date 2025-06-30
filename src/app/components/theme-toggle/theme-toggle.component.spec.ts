import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemetToggleComponent } from './theme-toggle.component';

describe('ThemetToggleComponent', () => {
  let component: ThemetToggleComponent;
  let fixture: ComponentFixture<ThemetToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemetToggleComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ThemetToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
