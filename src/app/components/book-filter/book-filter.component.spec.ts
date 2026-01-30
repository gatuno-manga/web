import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookFilterComponent } from './book-filter.component';
import { TagsService } from '../../service/tags.service';
import { SensitiveContentService } from '../../service/sensitive-content.service';
import { NotificationService } from '../../service/notification.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { of } from 'rxjs';

describe('BookFilterComponent', () => {
    let component: BookFilterComponent;
    let fixture: ComponentFixture<BookFilterComponent>;
    let tagsServiceSpy: jasmine.SpyObj<TagsService>;
    let sensitiveContentServiceSpy: jasmine.SpyObj<SensitiveContentService>;

    beforeEach(async () => {
        const tagsSpy = jasmine.createSpyObj('TagsService', ['getTags']);
        const sensitiveSpy = jasmine.createSpyObj('SensitiveContentService', ['getSensitiveContent', 'getContentAllow']);
        const notificationSpy = jasmine.createSpyObj('NotificationService', ['notify']);
        const modalSpy = jasmine.createSpyObj('ModalNotificationService', ['close']);

        tagsSpy.getTags.and.returnValue(of([]));
        sensitiveSpy.getSensitiveContent.and.returnValue(of([]));
        sensitiveSpy.getContentAllow.and.returnValue([]);

        await TestBed.configureTestingModule({
            imports: [BookFilterComponent],
            providers: [
                { provide: TagsService, useValue: tagsSpy },
                { provide: SensitiveContentService, useValue: sensitiveSpy },
                { provide: NotificationService, useValue: notificationSpy },
                { provide: ModalNotificationService, useValue: modalSpy }
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(BookFilterComponent);
        component = fixture.componentInstance;
        tagsServiceSpy = TestBed.inject(TagsService) as jasmine.SpyObj<TagsService>;
        sensitiveContentServiceSpy = TestBed.inject(SensitiveContentService) as jasmine.SpyObj<SensitiveContentService>;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
