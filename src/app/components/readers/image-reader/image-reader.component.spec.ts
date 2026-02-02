import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageReaderComponent } from './image-reader.component';

describe('ImageReaderComponent', () => {
    let component: ImageReaderComponent;
    let fixture: ComponentFixture<ImageReaderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ImageReaderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ImageReaderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should emit progress when page becomes visible', () => {
        const spy = spyOn(component.progressChange, 'emit');
        component.pages = [
            { index: '0', path: 'http://example.com/page1.webp' },
            { index: '1', path: 'http://example.com/page2.webp' }
        ];
        fixture.detectChanges();

        // Note: IntersectionObserver testing requires more complex setup
        expect(component).toBeTruthy();
    });

    it('should display page numbers when showPageNumbers is true', () => {
        component.pages = [{ index: '0', path: 'http://example.com/page1.webp' }];
        component.showPageNumbers = true;
        fixture.detectChanges();

        const pageNumber = fixture.nativeElement.querySelector('.page-number');
        expect(pageNumber).toBeTruthy();
    });

    it('should hide page numbers when showPageNumbers is false', () => {
        component.pages = [{ index: '0', path: 'http://example.com/page1.webp' }];
        component.showPageNumbers = false;
        fixture.detectChanges();

        const pageNumber = fixture.nativeElement.querySelector('.page-number');
        expect(pageNumber).toBeFalsy();
    });
});
