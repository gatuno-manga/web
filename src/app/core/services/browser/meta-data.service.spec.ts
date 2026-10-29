import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MetaDataService } from './meta-data.service';

describe('MetaDataService', () => {
	let service: MetaDataService;
	let mockMeta: any;
	let mockTitle: any;
	let mockRouter: any;
	let mockDoc: Document;

	beforeEach(() => {
		mockMeta = {
			addTag: jasmine.createSpy('addTag'),
			updateTag: jasmine.createSpy('updateTag').and.returnValue(null),
			removeTagElement: jasmine.createSpy('removeTagElement'),
		};
		mockTitle = { setTitle: jasmine.createSpy('setTitle') };
		mockRouter = {
			events: { subscribe: jasmine.createSpy('subscribe') },
		};
		mockDoc = document.implementation.createHTMLDocument('test');

		TestBed.configureTestingModule({
			providers: [
				{ provide: Meta, useValue: mockMeta },
				{ provide: Title, useValue: mockTitle },
				{ provide: Router, useValue: mockRouter },
				{ provide: 'DOCUMENT', useValue: mockDoc },
			],
		});
		service = new MetaDataService(
			mockMeta,
			mockTitle,
			mockDoc as any,
			mockRouter as any,
		);
	});

	it('should set title and update meta tags without using addTag', () => {
		service.setTitle('MyTitle');
		expect(mockTitle.setTitle).toHaveBeenCalledWith('MyTitle | Gatuno');
		expect(mockMeta.addTag).not.toHaveBeenCalled();

		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			property: 'og:site_name',
			content: 'Gatuno',
		});
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			name: 'twitter:site',
			content: 'Gatuno',
		});
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			property: 'og:title',
			content: 'MyTitle | Gatuno',
		});
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			name: 'twitter:title',
			content: 'MyTitle | Gatuno',
		});
	});

	it('should keep default title without | Gatuno suffix', () => {
		service.setTitle('Gatuno');
		expect(mockTitle.setTitle).toHaveBeenCalledWith('Gatuno');
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			property: 'og:title',
			content: 'Gatuno',
		});
	});

	it('setDescription should update tags', () => {
		service.setDescription('desc');
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			name: 'description',
			content: 'desc',
		});
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			property: 'og:description',
			content: 'desc',
		});
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			name: 'twitter:description',
			content: 'desc',
		});
	});

	it('setUrl should update tags and canonical link', () => {
		service.setUrl('https://gatuno.com/books/123');
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			property: 'og:url',
			content: 'https://gatuno.com/books/123',
		});
		expect(mockMeta.updateTag).toHaveBeenCalledWith({
			name: 'twitter:url',
			content: 'https://gatuno.com/books/123',
		});

		const canonicalLink = mockDoc.querySelector('link[rel="canonical"]');
		expect(canonicalLink).toBeTruthy();
		expect(canonicalLink?.getAttribute('href')).toBe(
			'https://gatuno.com/books/123',
		);
	});
});
