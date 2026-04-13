import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextReaderComponent } from './text-reader.component';
import { provideMarkdown } from 'ngx-markdown';
import { SettingsService } from '../../../service/settings.service';

describe('TextReaderComponent', () => {
	let component: TextReaderComponent;
	let fixture: ComponentFixture<TextReaderComponent>;
	let settingsService: SettingsService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TextReaderComponent],
			providers: [provideMarkdown()],
		}).compileComponents();

		fixture = TestBed.createComponent(TextReaderComponent);
		component = fixture.componentInstance;
		settingsService = TestBed.inject(SettingsService);
	});

	it('should create', () => {
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	it('should render markdown content', () => {
		component.content = '# Hello World';
		component.format = 'markdown';
		fixture.detectChanges();

		const container =
			fixture.nativeElement.querySelector('.markdown-content');
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

	it('should expose a textStyle compatibility API', () => {
		fixture.detectChanges();

		expect(component.textStyle()).toEqual(
			jasmine.objectContaining({
				'font-size': jasmine.any(String),
				'font-family': jasmine.any(String),
				'line-height': jasmine.any(String),
				'letter-spacing': jasmine.any(String),
				'text-align': jasmine.any(String),
			}),
		);
	});

	it('should apply settings updates through textStyle', () => {
		fixture.detectChanges();

		settingsService.updateSettings({
			fontSize: 22,
			fontFamily: 'Georgia, serif',
			lineHeight: 2,
			letterSpacing: 1.5,
			textAlign: 'left',
		});
		fixture.detectChanges();

		const style = component.textStyle();
		const container = fixture.nativeElement.querySelector(
			'.text-reader-container',
		);

		expect(style).toEqual(
			jasmine.objectContaining({
				'font-size': '22px',
				'font-family': 'Georgia, serif',
				'line-height': '2',
				'letter-spacing': '1.5px',
				'text-align': 'left',
			}),
		);
		expect(container.style.fontSize).toBe('22px');
		expect(container.style.fontFamily).toContain('Georgia');
		expect(container.style.lineHeight).toBe('2');
		expect(container.style.letterSpacing).toBe('1.5px');
		expect(container.style.textAlign).toBe('left');
	});

	it('should calculate virtual pages based on word count', () => {
		// 600 words should result in 2 virtual pages (300 words per page)
		const words = Array(600).fill('word').join(' ');
		component.content = words;
		component.ngOnInit();

		expect(component.getVirtualPages()).toBe(2);
	});
});
