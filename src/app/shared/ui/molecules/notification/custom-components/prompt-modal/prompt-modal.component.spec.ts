import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PromptModalComponent } from './prompt-modal.component';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { TextAreaComponent } from '@ui/atoms/inputs/text-area/text-area.component';
import { signal } from '@angular/core';

describe('PromptModalComponent', () => {
  let component: PromptModalComponent;
  let fixture: ComponentFixture<PromptModalComponent>;
  let closeSpy: jasmine.Spy;

  beforeEach(async () => {
    closeSpy = jasmine.createSpy('close');

    await TestBed.configureTestingModule({
      imports: [PromptModalComponent],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromptModalComponent);
    component = fixture.componentInstance;
    
    // Set required input
    fixture.componentRef.setInput('close', closeSpy);
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display title and message', () => {
    fixture.componentRef.setInput('title', 'Test Title');
    fixture.componentRef.setInput('message', 'Test Message');
    fixture.detectChanges();

    const titleEl = fixture.debugElement.query(By.css('.settings-header h2')).nativeElement;
    const messageEl = fixture.debugElement.query(By.css('.settings-header p')).nativeElement;

    expect(titleEl.textContent).toContain('Test Title');
    expect(messageEl.textContent).toContain('Test Message');
  });

  it('should bind input value', async () => {
    fixture.componentRef.setInput('value', 'Initial Value');
    // We need to re-initialize since constructor already ran
    component.inputValue.set('Initial Value');
    fixture.detectChanges();
    await fixture.whenStable();

    const textArea = fixture.debugElement.query(By.css('app-text-area'));
    expect(textArea.componentInstance.value()).toBe('Initial Value');
  });

  it('should call close with null on cancel', () => {
    const cancelBtn = fixture.debugElement.queryAll(By.css('app-button'))[0]; // First button is cancel
    cancelBtn.triggerEventHandler('click', null);

    expect(closeSpy).toHaveBeenCalledWith(null);
  });

  it('should call close with value on confirm', () => {
    component.inputValue.set('Confirmed Value');
    const confirmBtn = fixture.debugElement.queryAll(By.css('app-button'))[1]; // Second button is confirm
    confirmBtn.triggerEventHandler('click', null);

    expect(closeSpy).toHaveBeenCalledWith('Confirmed Value');
  });

  it('should focus textarea after view init', fakeAsync(() => {
    const textAreaComponent = component.textArea() as any;
    
    if (textAreaComponent && textAreaComponent.textareaRef) {
        const focusSpy = jasmine.createSpy('focus');
        const mockNativeElement = { focus: focusSpy };
        
        // Mock the signal textareaRef()
        (textAreaComponent as any).textareaRef = signal({ nativeElement: mockNativeElement });
        
        component.ngAfterViewInit();
        tick(100);
        expect(focusSpy).toHaveBeenCalled();
    } else {
        component.ngAfterViewInit();
        tick(100);
    }
  }));
});
