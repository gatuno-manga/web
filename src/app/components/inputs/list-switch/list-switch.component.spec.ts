import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListSwitchComponent } from './list-switch.component';

describe('ListSwitchComponent', () => {
  let component: ListSwitchComponent;
  let fixture: ComponentFixture<ListSwitchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListSwitchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
