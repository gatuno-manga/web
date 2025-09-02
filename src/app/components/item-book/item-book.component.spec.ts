import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemBookComponent } from './item-book.component';

describe('ItemBookComponent', () => {
  let component: ItemBookComponent;
  let fixture: ComponentFixture<ItemBookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemBookComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItemBookComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
