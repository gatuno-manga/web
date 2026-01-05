import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourceAddModalComponent } from './source-add-modal.component';

describe('SourceAddModalComponent', () => {
    let component: SourceAddModalComponent;
    let fixture: ComponentFixture<SourceAddModalComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SourceAddModalComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(SourceAddModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should validate URL format', () => {
        component.newUrl = 'invalid-url';
        expect(component.validateUrl()).toBeFalse();
        expect(component.urlError).toContain('inválida');
    });

    it('should accept valid URL', () => {
        component.newUrl = 'https://example.com/manga';
        expect(component.validateUrl()).toBeTrue();
        expect(component.urlError).toBe('');
    });

    it('should detect duplicate URLs', () => {
        component.existingUrls = ['https://example.com/manga'];
        component.newUrl = 'https://example.com/manga/';
        expect(component.validateUrl()).toBeFalse();
        expect(component.urlError).toContain('já foi adicionada');
    });

    it('should require http or https protocol', () => {
        component.newUrl = 'ftp://example.com/manga';
        expect(component.validateUrl()).toBeFalse();
        expect(component.urlError).toContain('http://');
    });
});
