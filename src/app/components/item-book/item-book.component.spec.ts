import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '../../../testing/shared-testing.module';

import { ItemBookComponent } from './item-book.component';

describe('ItemBookComponent', () => {
  let component: ItemBookComponent;
  let fixture: ComponentFixture<ItemBookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemBookComponent, SharedTestingModule],
    })
      .compileComponents();

    fixture = TestBed.createComponent(ItemBookComponent);
    component = fixture.componentInstance;
    component.book = { id: 'b1', title: 'Test', authors: [], covers: [] } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept type input and default to grid', () => {
    expect(component.type).toBe('grid');
    component.type = 'list';
    expect(component.type).toBe('list');
  });
});
