import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuComponent } from './context-menu.component';
import { ContextMenuService } from '../../service/context-menu.service';
import { IconsComponent } from '../icons/icons.component';
import { By } from '@angular/platform-browser';

describe('ContextMenuComponent', () => {
  let component: ContextMenuComponent;
  let fixture: ComponentFixture<ContextMenuComponent>;
  let service: ContextMenuService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContextMenuComponent, IconsComponent],
      providers: [ContextMenuService]
    }).compileComponents();

    fixture = TestBed.createComponent(ContextMenuComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(ContextMenuService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not be visible initially', () => {
    const menu = fixture.debugElement.query(By.css('.context-menu'));
    expect(menu).toBeNull();
  });

  it('should become visible when service state changes', () => {
    service.open(new MouseEvent('contextmenu'), [{ label: 'Test Item' }]);
    fixture.detectChanges();
    
    const menu = fixture.debugElement.query(By.css('.context-menu'));
    expect(menu).toBeTruthy();
  });

  it('should render items correctly', () => {
    service.open(new MouseEvent('contextmenu'), [
        { label: 'Item 1', icon: 'edit' },
        { label: 'Item 2', type: 'separator' },
        { label: 'Item 3', danger: true }
    ]);
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('.menu-item'));
    const separator = fixture.debugElement.query(By.css('.separator'));

    expect(items.length).toBe(2); // Separator is not a .menu-item
    expect(separator).toBeTruthy();
    expect(items[0].nativeElement.textContent).toContain('Item 1');
    expect(items[1].nativeElement.classList).toContain('danger');
  });

  it('should call action and close on item click', () => {
    const spy = jasmine.createSpy('action');
    service.open(new MouseEvent('contextmenu'), [
        { label: 'Action', action: spy }
    ]);
    fixture.detectChanges();

    const item = fixture.debugElement.query(By.css('.menu-item'));
    item.nativeElement.click();

    expect(spy).toHaveBeenCalled();
    expect(service.state().visible).toBeFalse();
  });

  it('should close on outside click', () => {
    service.open(new MouseEvent('contextmenu'), [{ label: 'Test' }]);
    fixture.detectChanges();

    document.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(service.state().visible).toBeFalse();
  });
});
