import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookDownloadModalComponent, BookDownloadChapter, BookDownloadResult } from './book-download-modal.component';

describe('BookDownloadModalComponent', () => {
    let component: BookDownloadModalComponent;
    let fixture: ComponentFixture<BookDownloadModalComponent>;

    const mockChapters: BookDownloadChapter[] = [
        { id: '1', title: 'Capítulo 1', index: 1 },
        { id: '2', title: 'Capítulo 2', index: 2 },
        { id: '3', index: 3 }
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BookDownloadModalComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BookDownloadModalComponent);
        component = fixture.componentInstance;
        component.chapters = mockChapters;
        component.bookTitle = 'Test Book';
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with all chapters selected', () => {
        component.ngOnInit();
        expect(component.selectedChapters().size).toBe(mockChapters.length);
    });

    it('should initialize with images format selected', () => {
        expect(component.selectedFormat()).toBe('images');
    });

    it('should toggle select all chapters', () => {
        component.ngOnInit();
        expect(component.allSelected()).toBeTrue();

        component.toggleSelectAll();
        expect(component.selectedChapters().size).toBe(0);
        expect(component.allSelected()).toBeFalse();

        component.toggleSelectAll();
        expect(component.selectedChapters().size).toBe(mockChapters.length);
        expect(component.allSelected()).toBeTrue();
    });

    it('should toggle individual chapter selection', () => {
        component.ngOnInit();
        const chapterId = '1';

        expect(component.isChapterSelected(chapterId)).toBeTrue();

        component.toggleChapter(chapterId);
        expect(component.isChapterSelected(chapterId)).toBeFalse();

        component.toggleChapter(chapterId);
        expect(component.isChapterSelected(chapterId)).toBeTrue();
    });

    it('should report someSelected when partially selected', () => {
        component.ngOnInit();
        component.toggleChapter('1');

        expect(component.someSelected()).toBeTrue();
        expect(component.allSelected()).toBeFalse();
    });

    it('should change format', () => {
        component.selectedFormat.set('pdfs');
        expect(component.selectedFormat()).toBe('pdfs');

        component.selectedFormat.set('images');
        expect(component.selectedFormat()).toBe('images');
    });

    it('should call close with result on confirm', () => {
        const closeSpy = jasmine.createSpy('close');
        component.close = closeSpy;
        component.ngOnInit();

        component.confirm();

        expect(closeSpy).toHaveBeenCalledWith({
            format: 'images',
            chapterIds: jasmine.arrayContaining(['1', '2', '3'])
        });
    });

    it('should not call close on confirm when no chapters selected', () => {
        const closeSpy = jasmine.createSpy('close');
        component.close = closeSpy;
        component.selectedChapters.set(new Set());

        component.confirm();

        expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should call close with null on cancel', () => {
        const closeSpy = jasmine.createSpy('close');
        component.close = closeSpy;

        component.cancel();

        expect(closeSpy).toHaveBeenCalledWith(null);
    });

    it('should return correct chapter label', () => {
        expect(component.getChapterLabel(mockChapters[0])).toBe('Capítulo 1');
        expect(component.getChapterLabel(mockChapters[2])).toBe('Capítulo 3');
    });
});
