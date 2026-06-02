import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalNotificationService } from '@core/services/modal-notification.service';
import { NotificationService } from '@core/services/notification.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { TagsService } from '@core/services/tags.service';
import { of } from 'rxjs';
import { BookFilterComponent } from './book-filter.component';

describe('BookFilterComponent', () => {
	let component: BookFilterComponent;
	let fixture: ComponentFixture<BookFilterComponent>;
	let _tagsServiceSpy: jasmine.SpyObj<TagsService>;
	let _sensitiveContentServiceSpy: jasmine.SpyObj<SensitiveContentService>;

	beforeEach(async () => {
		const tagsSpy = jasmine.createSpyObj('TagsService', ['getTags']);
		tagsSpy.excludedTagsSignal = signal([]);

		const sensitiveSpy = jasmine.createSpyObj('SensitiveContentService', [
			'getSensitiveContent',
			'getContentAllow',
		]);
		sensitiveSpy.allowContentSignal = signal([]);

		const notificationSpy = jasmine.createSpyObj('NotificationService', [
			'notify',
		]);
		const modalSpy = jasmine.createSpyObj('ModalNotificationService', [
			'close',
		]);

		tagsSpy.getTags.and.returnValue(of([]));
		sensitiveSpy.getSensitiveContent.and.returnValue(of([]));
		sensitiveSpy.getContentAllow.and.returnValue([]);

		await TestBed.configureTestingModule({
			imports: [BookFilterComponent],
			providers: [
				{ provide: TagsService, useValue: tagsSpy },
				{ provide: SensitiveContentService, useValue: sensitiveSpy },
				{ provide: NotificationService, useValue: notificationSpy },
				{ provide: ModalNotificationService, useValue: modalSpy },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(BookFilterComponent);
		component = fixture.componentInstance;
		_tagsServiceSpy = TestBed.inject(
			TagsService,
		) as jasmine.SpyObj<TagsService>;
		_sensitiveContentServiceSpy = TestBed.inject(
			SensitiveContentService,
		) as jasmine.SpyObj<SensitiveContentService>;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('Sensitive Content Changes', () => {
		it('should refetch tags and cleanup orphans when sensitive content changes', () => {
			// Arrange
			const initialTags = [
				{ id: 'tag1', name: 'Tag 1', description: '' },
				{ id: 'tag2', name: 'Tag 2', description: '' },
			];
			const updatedTags = [
				{ id: 'tag1', name: 'Tag 1', description: '' },
			]; // tag2 is gone

			_tagsServiceSpy.getTags.and.returnValue(of(initialTags));
			(component as any).fetchTags(); // Initial load

			component.selectedTags.set(['tag1', 'tag2']);
			component.excludedTags.set(['tag2']);

			// Act
			_tagsServiceSpy.getTags.and.returnValue(of(updatedTags));
			component.onSensitiveContentChange(['new-sensitive-id']);

			// Assert
			expect(_tagsServiceSpy.getTags).toHaveBeenCalled();
			expect(component.selectedTags()).toEqual(['tag1']);
			expect(component.excludedTags()).toEqual([]);
			expect(component.availableTags()).toEqual(updatedTags);
		});
	});
});
