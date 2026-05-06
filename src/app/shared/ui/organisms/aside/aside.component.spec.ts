import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { AsideComponent } from './aside.component';

describe('AsideComponent', () => {
  let component: AsideComponent;
  let fixture: ComponentFixture<AsideComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsideComponent, (await import('@angular/common/http/testing')).HttpClientTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(AsideComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggle/open/close should change isOpen', () => {
    component.isOpen = false;
    component.toggle();
    expect(component.isOpen).toBeTrue();
    component.close();
    expect(component.isOpen).toBeFalse();
    component.open();
    expect(component.isOpen).toBeTrue();
  });

  it('getDragTransform returns correct values for closed/open and direction', () => {
    component.position = 'right';
    (component as any).isDragging = false; // private but accessible in TS tests via cast
    component.isOpen = false;
    expect(component.getDragTransform()).toBe('translateX(100%)');

    component.isOpen = true;
    expect(component.getDragTransform()).toBe('translateX(0)');
  });

  it('handleKeyboardEvent with ctrl/meta + b toggles', () => {
    component.isOpen = false;
    const ev = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true });
    component.handleKeyboardEvent(ev as KeyboardEvent);
    expect(component.isOpen).toBeTrue();
  });
});
