import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '../../../testing/shared-testing.module';

import { SelectComponent } from './select.component';

describe('SelectComponent', () => {
  let component: SelectComponent;
  let fixture: ComponentFixture<SelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectComponent, SharedTestingModule]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SelectComponent);
    component = fixture.componentInstance;
    component.items = [
      { label: 'a', checked: jasmine.createSpy('a') },
      { label: 'b', checked: jasmine.createSpy('b') }
    ] as any;
    component.select = 0;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('onSelect rotates selection and calls checked', () => {
    component.onSelect();
    expect(component.select).toBe(1);
    expect(component.items[1].checked).toHaveBeenCalled();

    component.onSelect();
    expect(component.select).toBe(0);
  });
});
