import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoverEditModalComponent, CoverEditSaveEvent } from './cover-edit-modal.component';
import { Cover } from '@models/book.models';

describe('CoverEditModalComponent', () => {
    let component: CoverEditModalComponent;
    let fixture: ComponentFixture<CoverEditModalComponent>;

    const mockCover: Cover = {
        id: '123',
        title: 'Test Cover',
        url: 'https://example.com/cover.jpg',
        selected: false
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CoverEditModalComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CoverEditModalComponent);
        component = fixture.componentInstance;
        component.cover = mockCover;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with cover data on init', () => {
        component.ngOnInit();

        expect(component.editedTitle()).toBe(mockCover.title);
        expect(component.previewUrl()).toBe(mockCover.url);
        expect(component.imageError()).toBeFalse();
    });

    it('should update on cover changes', () => {
        const newCover: Cover = {
            id: '456',
            title: 'New Cover',
            url: 'https://example.com/new-cover.jpg',
            selected: false
        };

        component.ngOnChanges({
            cover: {
                currentValue: newCover,
                previousValue: mockCover,
                firstChange: false,
                isFirstChange: () => false
            }
        });
        component.cover = newCover;
        component.ngOnChanges({
            cover: {
                currentValue: newCover,
                previousValue: mockCover,
                firstChange: false,
                isFirstChange: () => false
            }
        });

        expect(component.editedTitle()).toBe(newCover.title);
        expect(component.previewUrl()).toBe(newCover.url);
    });

    it('should compute hasImage correctly', () => {
        component.previewUrl.set('https://example.com/image.jpg');
        expect(component.hasImage()).toBeTrue();

        component.previewUrl.set(null);
        expect(component.hasImage()).toBeFalse();
    });

    it('should set imageError on image load error', () => {
        expect(component.imageError()).toBeFalse();

        component.onImageError();

        expect(component.imageError()).toBeTrue();
    });

    it('should call close with save data on save', () => {
        const closeSpy = jasmine.createSpy('close');
        component.close = closeSpy;
        component.editedTitle.set('Updated Title');

        component.onSave();

        expect(closeSpy).toHaveBeenCalledWith({
            id: mockCover.id,
            title: 'Updated Title',
            file: undefined
        });
    });

    it('should call close with null on cancel', () => {
        const closeSpy = jasmine.createSpy('close');
        component.close = closeSpy;

        component.onCancel();

        expect(closeSpy).toHaveBeenCalledWith(null);
    });

    it('should handle file selection', () => {
        const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        const mockEvent = {
            target: {
                files: [mockFile]
            }
        } as unknown as Event;

        spyOn(URL, 'createObjectURL').and.returnValue('blob:test-url');

        component.onFileSelected(mockEvent);

        expect(component.selectedFile()).toBe(mockFile);
        expect(component.imageError()).toBeFalse();
    });

    it('should trigger file input click', () => {
        const mockInput = {
            click: jasmine.createSpy('click')
        } as unknown as HTMLInputElement;

        component.triggerFileInput(mockInput);

        expect(mockInput.click).toHaveBeenCalled();
    });
});
