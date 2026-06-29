import {
	CdkDragDrop,
	DragDropModule,
	moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, Input, inject, model, OnInit, signal } from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	FormsModule,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { AuthorsService } from '@core/services/authors.service';
import { NotificationService } from '@core/services/notification.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { TagsService } from '@core/services/tags.service';
import {
	AlternativeTitle,
	Author,
	BookBasic,
	BookDetail,
	LocalizedDescription,
	SensitiveContentResponse,
	TypeBook,
	tag,
	UpdateBookDto,
} from '@models/book.models';
import { FlagPipe } from '@shared/utils/pipes/flag.pipe';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { SelectComponent } from '@ui/atoms/inputs/select/select.component';
import { TextAreaComponent } from '@ui/atoms/inputs/text-area/text-area.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';
import { MultiSelectTagsComponent } from '@ui/organisms/multi-select-tags/multi-select-tags.component';
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
		MultiSelectTagsComponent,
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
	localizedDescriptions = signal<LocalizedDescription[]>([]);
	searchTerms = signal<string[]>([]);
	originalUrls = signal<string[]>([]);
	newSearchTerm = signal('');
	newUrl = signal('');

	// Master lists for selection
	availableTags = signal<tag[]>([]);
	availableAuthors = signal<Author[]>([]);
	availableSensitive = signal<SensitiveContentResponse[]>([]);

	// Selected IDs (Refactored to model signals for MultiSelectTags compatibility)
	selectedTagIds = model<string[]>([]);
	selectedAuthorIds = model<string[]>([]);
	selectedSensitiveIds = model<string[]>([]);

	bookTypes = Object.values(TypeBook).map((type) => ({
		value: type,
		label: type.charAt(0).toUpperCase() + type.slice(1),
	}));

	languageCodes = [
		{ value: '', label: 'Desconhecido' },
		{ value: 'ja-JP', label: 'Japonês' },
		{ value: 'ko-KR', label: 'Coreano' },
		{ value: 'zh-CN', label: 'Chinês (Simplificado)' },
		{ value: 'zh-TW', label: 'Chinês (Tradicional)' },
		{ value: 'en-US', label: 'Inglês (EUA)' },
		{ value: 'en-GB', label: 'Inglês (Reino Unido)' },
		{ value: 'pt-BR', label: 'Português (Brasil)' },
		{ value: 'pt-PT', label: 'Português (Portugal)' },
		{ value: 'es-ES', label: 'Espanhol (Espanha)' },
		{ value: 'es-419', label: 'Espanhol (América Latina)' },
		{ value: 'fr-FR', label: 'Francês' },
		{ value: 'it-IT', label: 'Italiano' },
		{ value: 'de-DE', label: 'Alemão' },
		{ value: 'ru-RU', label: 'Russo' },
		{ value: 'id-ID', label: 'Indonésio' },
		{ value: 'th-TH', label: 'Tailandês' },
		{ value: 'vi-VN', label: 'Vietnamita' },
	];

	ngOnInit(): void {
		this.initForm();
		this.loadMasterData();
	}

	private initForm(): void {
		const bookDetail = this.book as BookBasic & BookDetail;

		this.editForm = this.fb.group({
			title: [
				this.book.title,
				[Validators.required, Validators.maxLength(300)],
			],
			publication: [
				this.book.publication,
				[Validators.min(1900), Validators.max(2100)],
			],
			type: [this.book.type || TypeBook.OTHER],
			originalLanguageCode: [this.book.originalLanguageCode || ''],
		});

		this.localizedDescriptions.set([...(bookDetail.localizedDescriptions || [])]);
		if (this.localizedDescriptions().length === 0 && this.book.description) {
			this.localizedDescriptions.set([
				{ description: this.book.description, languageCode: this.book.originalLanguageCode || '' }
			]);
		}

		this.searchTerms.set([...(bookDetail.searchTerms || [])]);
		this.originalUrls.set([...(bookDetail.originalUrl || [])]);

		this.selectedTagIds.set(this.book.tags.map((t) => t.id));
		this.selectedAuthorIds.set(this.book.authors.map((a) => a.id));
		this.selectedSensitiveIds.set(
			this.book.sensitiveContent.map((s) => s.id),
		);
	}

	private loadMasterData(): void {
		forkJoin({
			tags: this.tagsService.getAllTags().pipe(
				map((res) => this.unwrapData(res)),
				catchError((err) => {
					console.warn('Error loading tags:', err);
					return of([]);
				}),
			),
			authors: this.authorsService.getAll().pipe(
				map((res) => this.unwrapData(res)),
				catchError((err) => {
					console.warn('Error loading authors:', err);
					return of([]);
				}),
			),
			sensitive: this.sensitiveContentService.getSensitiveContent().pipe(
				map((res) => this.unwrapData(res)),
				catchError((err) => {
					console.warn('Error loading sensitive content:', err);
					return of([]);
				}),
			),
		}).subscribe({
			next: (data) => {
				this.availableTags.set(data.tags as tag[]);
				this.availableAuthors.set(data.authors as Author[]);
				this.availableSensitive.set(
					data.sensitive as SensitiveContentResponse[],
				);
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Critical error loading book edit data:', err);
				this.isLoading.set(false);
			},
		});
	}

	private unwrapData<T>(res: T | { data: T }): T {
		if (res && typeof res === 'object' && 'data' in res) {
			return (res as { data: T }).data;
		}
		return res as T;
	}

	// --- Multilingual Synopses Management ---
	addLocalizedDescription(): void {
		this.localizedDescriptions.update(prev => [...prev, { description: '', languageCode: '', rank: prev.length }]);
	}

	removeLocalizedDescription(index: number): void {
		this.localizedDescriptions.update(prev => prev.filter((_, i) => i !== index));
	}

	updateLocalizedDescriptionText(index: number, text: string): void {
		this.localizedDescriptions.update(prev => {
			const next = [...prev];
			next[index].description = text;
			return next;
		});
	}

	updateLocalizedDescriptionLang(index: number, lang: string): void {
		this.localizedDescriptions.update(prev => {
			const next = [...prev];
			next[index].languageCode = lang;
			return next;
		});
	}

	onLocalizedDescriptionDrop(event: CdkDragDrop<LocalizedDescription[]>): void {
		this.localizedDescriptions.update((prev) => {
			const next = [...prev];
			moveItemInArray(next, event.previousIndex, event.currentIndex);
			return next;
		});
	}

	// --- Search Terms Management ---
	addSearchTerm(): void {
		const val = this.newSearchTerm().trim();
		if (val && !this.searchTerms().includes(val)) {
			this.searchTerms.update((prev) => [...prev, val]);
			this.newSearchTerm.set('');
		}
	}

	removeSearchTerm(index: number): void {
		this.searchTerms.update((prev) => prev.filter((_, i) => i !== index));
	}

	onSearchTermDrop(event: CdkDragDrop<string[]>): void {
		this.searchTerms.update((prev) => {
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
				this.originalUrls.update((prev) => [...prev, val]);
				this.newUrl.set('');
			} catch {
				// Handle invalid URL if needed
			}
		}
	}

	removeUrl(index: number): void {
		this.originalUrls.update((prev) => prev.filter((_, i) => i !== index));
	}

	onUrlDrop(event: CdkDragDrop<string[]>): void {
		this.originalUrls.update((prev) => {
			const next = [...prev];
			moveItemInArray(next, event.previousIndex, event.currentIndex);
			return next;
		});
	}

	// --- Dynamic Creation ---
	onCreateTag(name: string): void {
		const newId = 'temp-' + Date.now();
		this.availableTags.update(prev => [...prev, { id: newId, name }]);
		this.selectedTagIds.update(prev => [...prev, newId]);
	}

	onCreateAuthor(name: string): void {
		const newId = 'temp-' + Date.now();
		this.availableAuthors.update(prev => [...prev, { id: newId, name }]);
		this.selectedAuthorIds.update(prev => [...prev, newId]);
	}

	onCreateSensitive(name: string): void {
		const newId = 'temp-' + Date.now();
		this.availableSensitive.update(prev => [...prev, { id: newId, name }]);
		this.selectedSensitiveIds.update(prev => [...prev, newId]);
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
		const bookDetail = this.book as BookBasic & BookDetail;

		// Basic fields delta
		if (formValues.title !== this.book.title)
			updatedData.title = formValues.title;
		if (formValues.publication !== this.book.publication)
			updatedData.publication = formValues.publication;
		if (formValues.type !== this.book.type)
			updatedData.type = formValues.type;
		if (
			formValues.originalLanguageCode !==
			(this.book.originalLanguageCode || '')
		)
			updatedData.originalLanguageCode =
				formValues.originalLanguageCode === ''
					? null
					: formValues.originalLanguageCode;

		// Array fields delta (deep compare simplified)
		const currentLocDesc = this.localizedDescriptions().map((d, index) => ({ ...d, rank: index }));
		const originalLocDesc = bookDetail.localizedDescriptions || [];
		
		const currentLocDescMapped = currentLocDesc.map((d: LocalizedDescription) => `${d.languageCode}:${d.description}`).join('|');
		const originalLocDescMapped = originalLocDesc.map((d: LocalizedDescription) => `${d.languageCode}:${d.description}`).join('|');
		
		if (currentLocDescMapped !== originalLocDescMapped || currentLocDesc.length !== originalLocDesc.length) {
			updatedData.localizedDescriptions = currentLocDesc;
			// Atualiza a description principal se houver sinopses para manter compatibilidade
			if (currentLocDesc.length > 0) {
				updatedData.description = currentLocDesc[0].description;
			}
		}

		const currentSearchTerms = this.searchTerms();
		const originalSearchTerms = bookDetail.searchTerms || [];
		if (
			JSON.stringify(currentSearchTerms) !==
			JSON.stringify(originalSearchTerms)
		) {
			updatedData.searchTerms = currentSearchTerms;
		}

		const currentUrls = this.originalUrls();
		const originalUrls = bookDetail.originalUrl || [];
		if (JSON.stringify(currentUrls) !== JSON.stringify(originalUrls)) {
			updatedData.originalUrl = currentUrls;
		}

		// Categorization delta (compare sets of IDs)
		const currentTagIds = Array.from(this.selectedTagIds());
		const originalTagIds = this.book.tags.map((t) => t.id);
		if (
			JSON.stringify(currentTagIds.sort()) !==
			JSON.stringify(originalTagIds.sort())
		) {
			// Convert IDs back to names for the backend
			updatedData.tags = currentTagIds
				.map(
					(id) =>
						this.availableTags().find((t) => t.id === id)?.name ||
						'',
				)
				.filter((n) => !!n);
		}

		const currentAuthorIds = Array.from(this.selectedAuthorIds());
		const originalAuthorIds = this.book.authors.map((a) => a.id);
		if (
			JSON.stringify(currentAuthorIds.sort()) !==
			JSON.stringify(originalAuthorIds.sort())
		) {
			// Convert IDs back to {name} objects for the backend
			updatedData.authors = currentAuthorIds
				.map((id) => {
					const author = this.availableAuthors().find(
						(a) => a.id === id,
					);
					return { name: author?.name || '' };
				})
				.filter((a) => !!a.name);
		}

		const currentSensitiveIds = Array.from(this.selectedSensitiveIds());
		const originalSensitiveIds = this.book.sensitiveContent.map(
			(s) => s.id,
		);
		if (
			JSON.stringify(currentSensitiveIds.sort()) !==
			JSON.stringify(originalSensitiveIds.sort())
		) {
			// Convert IDs back to names for the backend
			updatedData.sensitiveContent = currentSensitiveIds
				.map(
					(id) =>
						this.availableSensitive().find((s) => s.id === id)
							?.name || '',
				)
				.filter((n) => !!n);
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
		} catch (_e) {
			return url;
		}
	}
}
