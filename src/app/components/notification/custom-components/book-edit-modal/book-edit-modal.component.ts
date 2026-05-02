import { Component, Input, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { TextInputComponent } from '@components/inputs/text-input/text-input.component';
import { TextAreaComponent } from '@components/inputs/text-area/text-area.component';
import { SelectComponent } from '@components/inputs/select/select.component';
import { IconsComponent } from '@components/icons/icons.component';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
	BookBasic,
	TypeBook,
	UpdateBookDto,
	tag,
	Author,
	SensitiveContentResponse,
} from '../../../../models/book.models';
import { TagsService } from '../../../../service/tags.service';
import { AuthorsService } from '../../../../service/authors.service';
import { SensitiveContentService } from '../../../../service/sensitive-content.service';
import { NotificationService } from '../../../../service/notification.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface BookEditSaveEvent {
	id: string;
	data: UpdateBookDto;
}

@Component({
	selector: 'app-book-edit-modal',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		ButtonComponent,
		TextInputComponent,
		TextAreaComponent,
		SelectComponent,
		IconsComponent,
		DragDropModule,
	],
	templateUrl: './book-edit-modal.component.html',
	styleUrls: ['./book-edit-modal.component.scss'],
})
export class BookEditModalComponent implements OnInit {
	@Input() book!: BookBasic;
	@Input() close!: (result: BookEditSaveEvent | null) => void;

	private fb = inject(FormBuilder);
	private tagsService = inject(TagsService);
	private authorsService = inject(AuthorsService);
	private sensitiveContentService = inject(SensitiveContentService);
	private notificationService = inject(NotificationService);

	editForm!: FormGroup;
	isLoading = signal(true);
	isSaving = signal(false);

	// Multi-value fields managed with signals for easier UI binding and reordering
	alternativeTitles = signal<string[]>([]);
	originalUrls = signal<string[]>([]);
	
	newAltTitle = signal('');
	newUrl = signal('');

	// Master lists for selection
	availableTags = signal<tag[]>([]);
	availableAuthors = signal<Author[]>([]);
	availableSensitive = signal<SensitiveContentResponse[]>([]);

	// Search filters
	tagSearch = signal('');
	authorSearch = signal('');

	filteredTags = computed(() => {
		const query = this.tagSearch().toLowerCase().trim();
		if (!query) return []; // Oculta a lista global se não houver busca
		return this.availableTags().filter(t => t.name.toLowerCase().includes(query));
	});

	filteredAuthors = computed(() => {
		const query = this.authorSearch().toLowerCase().trim();
		if (!query) return []; // Oculta a lista global se não houver busca
		return this.availableAuthors().filter(a => a.name.toLowerCase().includes(query));
	});

	selectedTagsNotInFilter = computed(() => {
		const filteredIds = new Set(this.filteredTags().map(t => t.id));
		return this.availableTags().filter(t => this.selectedTagIds().has(t.id) && !filteredIds.has(t.id));
	});

	selectedAuthorsNotInFilter = computed(() => {
		const filteredIds = new Set(this.filteredAuthors().map(a => a.id));
		return this.availableAuthors().filter(a => this.selectedAuthorIds().has(a.id) && !filteredIds.has(a.id));
	});

	// Selected IDs
	selectedTagIds = signal<Set<string>>(new Set());
	selectedAuthorIds = signal<Set<string>>(new Set());
	selectedSensitiveIds = signal<Set<string>>(new Set());

	bookTypes = Object.values(TypeBook).map(type => ({
		value: type,
		label: type.charAt(0).toUpperCase() + type.slice(1)
	}));

	ngOnInit(): void {
		this.initForm();
		this.loadMasterData();
	}

	private initForm(): void {
		this.editForm = this.fb.group({
			title: [this.book.title, [Validators.required, Validators.maxLength(300)]],
			description: [this.book.description, [Validators.maxLength(5000)]],
			publication: [this.book.publication, [Validators.min(1900), Validators.max(2100)]],
			type: [this.book.type || TypeBook.OTHER],
		});

		this.alternativeTitles.set([...(this.book as any).alternativeTitle || []]);
		this.originalUrls.set([...(this.book as any).originalUrl || []]);
		
		this.selectedTagIds.set(new Set(this.book.tags.map(t => t.id)));
		this.selectedAuthorIds.set(new Set(this.book.authors.map(a => a.id)));
		this.selectedSensitiveIds.set(new Set(this.book.sensitiveContent.map(s => s.id)));
	}

	private loadMasterData(): void {
		forkJoin({
			tags: this.tagsService.getAllTags().pipe(
				map(res => this.unwrapData(res)),
				catchError(err => {
					console.warn('Error loading tags:', err);
					return of([]);
				})
			),
			authors: this.authorsService.getAll().pipe(
				map(res => this.unwrapData(res)),
				catchError(err => {
					console.warn('Error loading authors:', err);
					return of([]);
				})
			),
			sensitive: this.sensitiveContentService.getSensitiveContent().pipe(
				map(res => this.unwrapData(res)),
				catchError(err => {
					console.warn('Error loading sensitive content:', err);
					return of([]);
				})
			)
		}).subscribe({
			next: (data) => {
				this.availableTags.set(data.tags as tag[]);
				this.availableAuthors.set(data.authors as Author[]);
				this.availableSensitive.set(data.sensitive as SensitiveContentResponse[]);
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Critical error loading book edit data:', err);
				this.isLoading.set(false);
			}
		});
	}

	private unwrapData<T>(res: T | { data: T }): T {
		if (res && typeof res === 'object' && 'data' in res) {
			return (res as { data: T }).data;
		}
		return res as T;
	}

	// --- Alternative Titles Management ---
	addAltTitle(): void {
		const val = this.newAltTitle().trim();
		if (val && !this.alternativeTitles().includes(val)) {
			this.alternativeTitles.update(prev => [...prev, val]);
			this.newAltTitle.set('');
		}
	}

	removeAltTitle(index: number): void {
		this.alternativeTitles.update(prev => prev.filter((_, i) => i !== index));
	}

	onAltTitleDrop(event: CdkDragDrop<string[]>): void {
		this.alternativeTitles.update(prev => {
			const next = [...prev];
			moveItemInArray(next, event.previousIndex, event.currentIndex);
			return next;
		});
	}

	// --- Original URLs Management ---
	addUrl(): void {
		const val = this.newUrl().trim();
		if (val && !this.originalUrls().includes(val)) {
			try {
				new URL(val); // Simple validation
				this.originalUrls.update(prev => [...prev, val]);
				this.newUrl.set('');
			} catch {
				// Handle invalid URL if needed
			}
		}
	}

	removeUrl(index: number): void {
		this.originalUrls.update(prev => prev.filter((_, i) => i !== index));
	}

	onUrlDrop(event: CdkDragDrop<string[]>): void {
		this.originalUrls.update(prev => {
			const next = [...prev];
			moveItemInArray(next, event.previousIndex, event.currentIndex);
			return next;
		});
	}

	// --- Multi-select Toggles ---
	toggleTag(id: string): void {
		this.selectedTagIds.update(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	toggleAuthor(id: string): void {
		this.selectedAuthorIds.update(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	toggleSensitive(id: string): void {
		this.selectedSensitiveIds.update(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	// --- Action Handlers ---
	onSave(): void {
		if (this.editForm.invalid) {
			this.editForm.markAllAsTouched();
			return;
		}

		this.isSaving.set(true);

		const formValues = this.editForm.value;
		const updatedData: UpdateBookDto = {};

		// Basic fields delta
		if (formValues.title !== this.book.title) updatedData.title = formValues.title;
		if (formValues.description !== this.book.description) updatedData.description = formValues.description;
		if (formValues.publication !== this.book.publication) updatedData.publication = formValues.publication;
		if (formValues.type !== this.book.type) updatedData.type = formValues.type;

		// Array fields delta (deep compare simplified)
		const currentAltTitles = this.alternativeTitles();
		const originalAltTitles = (this.book as any).alternativeTitle || [];
		if (JSON.stringify(currentAltTitles) !== JSON.stringify(originalAltTitles)) {
			updatedData.alternativeTitle = currentAltTitles;
		}

		const currentUrls = this.originalUrls();
		const originalUrls = (this.book as any).originalUrl || [];
		if (JSON.stringify(currentUrls) !== JSON.stringify(originalUrls)) {
			updatedData.originalUrl = currentUrls;
		}

		// Categorization delta (compare sets of IDs)
		const currentTagIds = Array.from(this.selectedTagIds());
		const originalTagIds = this.book.tags.map(t => t.id);
		if (JSON.stringify(currentTagIds.sort()) !== JSON.stringify(originalTagIds.sort())) {
			// Convert IDs back to names for the backend
			updatedData.tags = currentTagIds.map(id => 
				this.availableTags().find(t => t.id === id)?.name || ''
			).filter(n => !!n);
		}

		const currentAuthorIds = Array.from(this.selectedAuthorIds());
		const originalAuthorIds = this.book.authors.map(a => a.id);
		if (JSON.stringify(currentAuthorIds.sort()) !== JSON.stringify(originalAuthorIds.sort())) {
			// Convert IDs back to {name} objects for the backend
			updatedData.authors = currentAuthorIds.map(id => {
				const author = this.availableAuthors().find(a => a.id === id);
				return { name: author?.name || '' };
			}).filter(a => !!a.name);
		}

		const currentSensitiveIds = Array.from(this.selectedSensitiveIds());
		const originalSensitiveIds = this.book.sensitiveContent.map(s => s.id);
		if (JSON.stringify(currentSensitiveIds.sort()) !== JSON.stringify(originalSensitiveIds.sort())) {
			// Convert IDs back to names for the backend
			updatedData.sensitiveContent = currentSensitiveIds.map(id => 
				this.availableSensitive().find(s => s.id === id)?.name || ''
			).filter(n => !!n);
		}

		if (Object.keys(updatedData).length === 0) {
			this.notificationService.info('Nenhuma alteração detectada.');
			this.isSaving.set(false);
			this.onCancel();
			return;
		}

		if (this.close) {
			this.close({ id: this.book.id, data: updatedData });
		}
	}

	onCancel(): void {
		if (this.close) {
			this.close(null);
		}
	}

	urlTransform(url: string): string {
		try {
			return new URL(url).hostname;
		} catch (e) {
			return url;
		}
	}
}
