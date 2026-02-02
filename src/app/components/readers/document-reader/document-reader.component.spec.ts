import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentReaderComponent } from './document-reader.component';

describe('DocumentReaderComponent', () => {
    let component: DocumentReaderComponent;
    let fixture: ComponentFixture<DocumentReaderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DocumentReaderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DocumentReaderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should display pdf viewer for pdf format', () => {
        component.src = 'http://example.com/test.pdf';
        component.format = 'pdf';
        component.ngOnInit();
        fixture.detectChanges();

        expect(component.isPdfFormat).toBe(true);
    });

    it('should display unsupported message for epub format', () => {
        component.src = 'http://example.com/test.epub';
        component.format = 'epub';
        fixture.detectChanges();

        expect(component.isPdfFormat).toBe(false);
        const unsupported = fixture.nativeElement.querySelector('.unsupported-format');
        expect(unsupported).toBeTruthy();
    });

    it('should emit page change on init', () => {
        const spy = spyOn(component.pageChange, 'emit');
        component.src = 'http://example.com/test.pdf';
        component.ngOnInit();

        expect(spy).toHaveBeenCalledWith({
            pageIndex: 0,
            totalPages: 1
        });
    });

    it('should use initial page parameter', () => {
        component.src = 'http://example.com/test.pdf';
        component.initialPage = 5;
        component.ngOnInit();

        expect(component.getCurrentPage()).toBe(5);
    });
});
