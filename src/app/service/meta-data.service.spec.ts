import { TestBed } from '@angular/core/testing';
import { MetaDataService } from './meta-data.service';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

describe('MetaDataService', () => {
    let service: MetaDataService;
    const mockMeta = { addTag: jasmine.createSpy('addTag'), updateTag: jasmine.createSpy('updateTag').and.returnValue(null), removeTagElement: jasmine.createSpy('removeTagElement') } as any;
    const mockTitle = { setTitle: jasmine.createSpy('setTitle') } as any;
    const mockRouter = { events: { subscribe: jasmine.createSpy('subscribe') } } as any;
    const mockDoc = document.implementation.createHTMLDocument('test');

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                { provide: Meta, useValue: mockMeta },
                { provide: Title, useValue: mockTitle },
                { provide: Router, useValue: mockRouter },
                { provide: 'DOCUMENT', useValue: mockDoc }
            ]
        });
        service = new MetaDataService(mockMeta, mockTitle, mockDoc as any, mockRouter as any);
    });

    it('should set title and meta tags', () => {
        service.setTitle('MyTitle');
        expect(mockTitle.setTitle).toHaveBeenCalled();
        expect(mockMeta.addTag).toHaveBeenCalled();
    });

    it('setDescription should update tags', () => {
        service.setDescription('desc');
        expect(mockMeta.updateTag).toHaveBeenCalled();
    });
});
