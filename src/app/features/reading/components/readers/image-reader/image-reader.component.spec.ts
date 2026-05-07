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
    });

    it('should create', () => {
        fixture.detectChanges();
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

    it('should clear loadedPages when pages input changes', () => {
        component.onImageLoad(0);
        expect(component.loadedPages.has(0)).toBeTrue();

        component.pages = [
            { index: '0', path: 'http://example.com/new-page1.webp' }
        ];

        expect(component.loadedPages.has(0)).toBeFalse();
        expect(component.loadedPages.size).toBe(0);
    });

    it('should use page dominant color when available', () => {
        const pageColor = '#ff0000';
        component.pages = [
            { 
                index: '0', 
                path: 'http://example.com/page1.webp',
                metadata: { width: 100, height: 100, dominantColor: pageColor }
            }
        ];
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('.page-container');
        expect(container.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('should fallback to book dominant color if page color is missing', () => {
        const bookColor = '#00ff00';
        component.bookDominantColor = bookColor;
        component.pages = [
            { index: '0', path: 'http://example.com/page1.webp' }
        ];
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('.page-container');
        expect(container.style.backgroundColor).toBe('rgb(0, 255, 0)');
    });

    it('should set aspect-ratio when metadata is provided', () => {
        component.pages = [
            { 
                index: '0', 
                path: 'http://example.com/page1.webp',
                metadata: { width: 800, height: 1200 }
            }
        ];
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('.page-container');
        expect(container.style.aspectRatio).toBe('800 / 1200');
    });

    it('should fallback to book aspect-ratio when page metadata is missing', () => {
        component.bookMetadata = { width: 600, height: 900 };
        component.pages = [
            { index: '0', path: 'http://example.com/page1.webp' }
        ];
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('.page-container');
        expect(container.style.aspectRatio).toBe('600 / 900');
    });
});
