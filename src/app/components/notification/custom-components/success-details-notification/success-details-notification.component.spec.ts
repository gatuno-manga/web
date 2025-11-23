import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SuccessDetailsNotificationComponent } from './success-details-notification.component';

describe('SuccessDetailsNotificationComponent', () => {
    let component: SuccessDetailsNotificationComponent;
    let fixture: ComponentFixture<SuccessDetailsNotificationComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SuccessDetailsNotificationComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SuccessDetailsNotificationComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should display default title', () => {
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('h2')?.textContent).toBe('Sucesso!');
    });

    it('should display custom title', (done) => {
        component.title = 'Upload concluído!';
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement;
            expect(compiled.querySelector('h2')?.textContent).toBe('Upload concluído!');
            done();
        });
    });

    it('should display message', () => {
        component.message = 'Operação realizada com sucesso';
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.main-message')?.textContent).toBe('Operação realizada com sucesso');
    });

    it('should not display items list when items not provided', () => {
        component.items = undefined;
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.items-list')).toBeFalsy();
    });

    it('should display items list when items provided', (done) => {
        component.items = ['Item 1', 'Item 2', 'Item 3'];
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement;
            const itemsList = compiled.querySelector('.items-list');
            expect(itemsList).toBeTruthy();
            const listItems = itemsList.querySelectorAll('li');
            expect(listItems.length).toBe(3);
            done();
        });
    });

    it('should display custom items title', (done) => {
        component.items = ['Item 1'];
        component.itemsTitle = 'Arquivos processados';
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement;
            expect(compiled.querySelector('.items-list strong')?.textContent).toContain('Arquivos processados');
            done();
        });
    });

    it('should not display action button when actionLabel not provided', () => {
        component.actionLabel = undefined;
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.action-button')).toBeFalsy();
    });

    it('should not display action button when actionCallback not provided', () => {
        component.actionLabel = 'Clique aqui';
        component.actionCallback = undefined;
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.action-button')).toBeFalsy();
    });

    it('should display action button when both actionLabel and actionCallback provided', (done) => {
        component.actionLabel = 'Ver detalhes';
        component.actionCallback = () => {};
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement;
            const button = compiled.querySelector('.action-button');
            expect(button).toBeTruthy();
            expect(button?.textContent?.trim()).toBe('Ver detalhes');
            done();
        });
    });

    it('should call actionCallback when button clicked', (done) => {
        const mockCallback = jasmine.createSpy('callback');
        component.actionLabel = 'Ação';
        component.actionCallback = mockCallback;
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const button = fixture.nativeElement.querySelector('.action-button');
            button.click();
            expect(mockCallback).toHaveBeenCalled();
            done();
        });
    });

    it('should display success icon', () => {
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.icon-success svg')).toBeTruthy();
    });

    it('should display check marks for each item', () => {
        component.items = ['Item 1', 'Item 2'];
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        const checks = compiled.querySelectorAll('.check');
        expect(checks.length).toBe(2);
    });
});
