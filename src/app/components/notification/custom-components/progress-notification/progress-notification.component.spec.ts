import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressNotificationComponent } from './progress-notification.component';

describe('ProgressNotificationComponent', () => {
    let component: ProgressNotificationComponent;
    let fixture: ComponentFixture<ProgressNotificationComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ProgressNotificationComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ProgressNotificationComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should display default title', () => {
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('h3')?.textContent).toBe('Processando');
    });

    it('should display progress percentage', () => {
        component.progress = 50;
        fixture.detectChanges();
        const compiled = fixture.nativeElement;
        expect(compiled.querySelector('.percentage')?.textContent).toContain('50%');
    });

    it('should update progress bar width', () => {
        component.progress = 75;
        fixture.detectChanges();
        const progressFill = fixture.nativeElement.querySelector('.progress-fill');
        expect(progressFill.style.width).toBe('75%');
    });

    it('should display status message', (done) => {
        component.statusMessage = 'Teste de status';
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement;
            expect(compiled.querySelector('.status')?.textContent).toBe('Teste de status');
            done();
        });
    });

    it('should display current item when provided', (done) => {
        component.currentItem = 'arquivo.txt';
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement;
            expect(compiled.querySelector('.current-item')).toBeTruthy();
            expect(compiled.querySelector('.current-item strong')?.textContent).toBe('arquivo.txt');
            done();
        });
    });

    it('should not display current item when not provided', (done) => {
        component.currentItem = undefined;
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement;
            expect(compiled.querySelector('.current-item')).toBeFalsy();
            done();
        });
    });

    it('should accept custom title', (done) => {
        component.title = 'Upload em progresso';
        fixture.detectChanges();
        setTimeout(() => {
            fixture.detectChanges();
            const compiled = fixture.nativeElement;
            expect(compiled.querySelector('h3')?.textContent).toBe('Upload em progresso');
            done();
        });
    });
});
