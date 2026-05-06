import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationNotificationComponent } from './confirmation-notification.component';
import { provideHttpClient } from '@angular/common/http';

describe('ConfirmationNotificationComponent', () => {
    let component: ConfirmationNotificationComponent;
    let fixture: ComponentFixture<ConfirmationNotificationComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ConfirmationNotificationComponent],
            providers: [provideHttpClient()]
        }).compileComponents();

        fixture = TestBed.createComponent(ConfirmationNotificationComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should display default title', () => {
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('h2')?.textContent).toBe('Confirmação');
    });

    it('should display custom title', () => {
        component.title = 'Confirmar exclusão';
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('h2')?.textContent).toBe('Confirmar exclusão');
    });

    it('should display message', () => {
        component.message = 'Você tem certeza?';
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.message')?.textContent).toBe('Você tem certeza?');
    });

    it('should display warning box by default', () => {
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.warning-box')).toBeTruthy();
    });

    it('should hide warning box when showWarning is false', () => {
        component.showWarning = false;
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.warning-box')).toBeFalsy();
    });

    it('should not display details when not provided', () => {
        component.details = undefined;
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.details')).toBeFalsy();
    });

    it('should display details when provided', () => {
        component.details = ['Detalhe 1', 'Detalhe 2', 'Detalhe 3'];
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        const detailsDiv = compiled.querySelector('.details');
        expect(detailsDiv).toBeTruthy();
        const listItems = detailsDiv.querySelectorAll('li');
        expect(listItems.length).toBe(3);
        expect(listItems[0].textContent).toBe('Detalhe 1');
        expect(listItems[1].textContent).toBe('Detalhe 2');
        expect(listItems[2].textContent).toBe('Detalhe 3');
    });

    it('should display warning icon in SVG', async () => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.icon-container svg')).toBeTruthy();
    });
});
