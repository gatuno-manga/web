import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextReaderComponent } from './text-reader.component';
import { provideMarkdown } from 'ngx-markdown';

describe('TextReaderComponent', () => {
    let component: TextReaderComponent;
    let fixture: ComponentFixture<TextReaderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TextReaderComponent],
            providers: [provideMarkdown()]
        }).compileComponents();

        fixture = TestBed.createComponent(TextReaderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render markdown content', () => {
        component.content = '# Hello World';
        component.format = 'markdown';
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('.markdown-content');
        expect(container).toBeTruthy();
    });

    it('should render html content', () => {
        component.content = '<p>Hello World</p>';
        component.format = 'html';
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('.html-content');
        expect(container).toBeTruthy();
    });

    it('should render plain text content', () => {
        component.content = 'Hello World';
        component.format = 'plain';
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('.plain-content');
        expect(container).toBeTruthy();
        expect(container.textContent).toContain('Hello World');
    });

    it('should calculate virtual pages based on word count', () => {
        // 600 words should result in 2 virtual pages (300 words per page)
        const words = Array(600).fill('word').join(' ');
        component.content = words;
        component.ngOnInit();

        expect(component.getVirtualPages()).toBe(2);
    });
});
