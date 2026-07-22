import {
	CdkDragDrop,
	DragDropModule,
	moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	input,
	model,
	OnInit,
	signal,
} from '@angular/core';
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
	Author,
	BookBasic,
	BookDetail,
	LocalizedDescription,
	SensitiveContentResponse,
	TypeBook,
	tag,
	UpdateBookDto,
} from '@models/book.models';
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
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookEditModalComponent implements OnInit {
	book = input.required<BookBasic>();
	close = input.required<(result: BookEditSaveEvent | null) => void>();

	activeTab = signal<'Básico' | 'Sinopses' | 'Categorias' | 'Links'>(
		'Básico',
	);

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
		{
			value: '',
			label: 'Desconhecido',
			imageUrl: '/assets/flags/unknown.svg',
		},
		{ value: 'ja-JP', label: 'Japonês', imageUrl: '/assets/flags/jp.svg' },
		{ value: 'ko-KR', label: 'Coreano', imageUrl: '/assets/flags/kr.svg' },
		{
			value: 'zh-CN',
			label: 'Chinês (Simplificado)',
			imageUrl: '/assets/flags/cn.svg',
		},
		{
			value: 'zh-TW',
			label: 'Chinês (Tradicional)',
			imageUrl: '/assets/flags/tw.svg',
		},
		{
			value: 'en-US',
			label: 'Inglês (EUA)',
			imageUrl: '/assets/flags/us.svg',
		},
		{
			value: 'en-GB',
			label: 'Inglês (Reino Unido)',
			imageUrl: '/assets/flags/gb.svg',
		},
		{
			value: 'pt-BR',
			label: 'Português (Brasil)',
			imageUrl: '/assets/flags/br.svg',
		},
		{
			value: 'pt-PT',
			label: 'Português (Portugal)',
			imageUrl: '/assets/flags/pt.svg',
		},
		{
			value: 'es-ES',
			label: 'Espanhol (Espanha)',
			imageUrl: '/assets/flags/es.svg',
		},
		{
			value: 'es-419',
			label: 'Espanhol (América Latina)',
			imageUrl: '/assets/flags/es.svg',
		},
		{ value: 'fr-FR', label: 'Francês', imageUrl: '/assets/flags/fr.svg' },
		{ value: 'it-IT', label: 'Italiano', imageUrl: '/assets/flags/it.svg' },
		{ value: 'de-DE', label: 'Alemão', imageUrl: '/assets/flags/de.svg' },
		{ value: 'ru-RU', label: 'Russo', imageUrl: '/assets/flags/ru.svg' },
		{
			value: 'id-ID',
			label: 'Indonésio',
			imageUrl: '/assets/flags/id.svg',
		},
		{
			value: 'th-TH',
			label: 'Tailandês',
			imageUrl: '/assets/flags/th.svg',
		},
		{
			value: 'vi-VN',
			label: 'Vietnamita',
			imageUrl: '/assets/flags/vn.svg',
		},
	];

	ngOnInit(): void {
		this.initForm();
		this.loadMasterData();
	}

	private initForm(): void {
		const bookDetail = this.book() as BookBasic & BookDetail;
		const b = this.book();

		this.editForm = this.fb.group({
			title: [b.title, [Validators.required, Validators.maxLength(300)]],
			publication: [
				b.publication,
				[Validators.min(1900), Validators.max(2100)],
			],
			type: [b.type || TypeBook.OTHER],
			originalLanguageCode: [b.originalLanguageCode || ''],
		});

		this.localizedDescriptions.set([
			...(bookDetail.localizedDescriptions || []),
		]);
		if (this.localizedDescriptions().length === 0 && b.description) {
			this.localizedDescriptions.set([
				{
					description: b.description,
					languageCode: b.originalLanguageCode || '',
				},
			]);
		}

		this.searchTerms.set([...(bookDetail.searchTerms || [])]);
		this.originalUrls.set([...(bookDetail.originalUrl || [])]);

		this.selectedTagIds.set(b.tags.map((t) => t.id));
		this.selectedAuthorIds.set(b.authors.map((a) => a.id));
		this.selectedSensitiveIds.set(b.sensitiveContent.map((s) => s.id));
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
		this.localizedDescriptions.update((prev) => [
			...prev,
			{ description: '', languageCode: '', rank: prev.length },
		]);
	}

	removeLocalizedDescription(index: number): void {
		this.localizedDescriptions.update((prev) =>
			prev.filter((_, i) => i !== index),
		);
	}

	updateLocalizedDescriptionText(index: number, text: string): void {
		this.localizedDescriptions.update((prev) => {
			const next = [...prev];
			next[index].description = text;
			return next;
		});
	}

	updateLocalizedDescriptionLang(index: number, lang: string): void {
		this.localizedDescriptions.update((prev) => {
			const next = [...prev];
			next[index].languageCode = lang;
			return next;
		});
	}

	onLocalizedDescriptionDrop(
		event: CdkDragDrop<LocalizedDescription[]>,
	): void {
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
		const newId = `temp-${Date.now()}`;
		this.availableTags.update((prev) => [...prev, { id: newId, name }]);
		this.selectedTagIds.update((prev) => [...prev, newId]);
	}

	onCreateAuthor(name: string): void {
		const newId = `temp-${Date.now()}`;
		this.availableAuthors.update((prev) => [...prev, { id: newId, name }]);
		this.selectedAuthorIds.update((prev) => [...prev, newId]);
	}

	onCreateSensitive(name: string): void {
		const newId = `temp-${Date.now()}`;
		this.availableSensitive.update((prev) => [
			...prev,
			{ id: newId, name },
		]);
		this.selectedSensitiveIds.update((prev) => [...prev, newId]);
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
		const bookDetail = this.book() as BookBasic & BookDetail;
		const b = this.book();

		// Basic fields delta
		if (formValues.title !== b.title) updatedData.title = formValues.title;
		if (formValues.publication !== b.publication)
			updatedData.publication = formValues.publication;
		if (formValues.type !== b.type) updatedData.type = formValues.type;
		if (formValues.originalLanguageCode !== (b.originalLanguageCode || ''))
			updatedData.originalLanguageCode =
				formValues.originalLanguageCode === ''
					? null
					: formValues.originalLanguageCode;

		// Array fields delta (deep compare simplified)
		const currentLocDesc = this.localizedDescriptions().map((d, index) => ({
			...d,
			rank: index,
		}));
		const originalLocDesc = bookDetail.localizedDescriptions || [];

		const currentLocDescMapped = currentLocDesc
			.map(
				(d: LocalizedDescription) =>
					`${d.languageCode}:${d.description}`,
			)
			.join('|');
		const originalLocDescMapped = originalLocDesc
			.map(
				(d: LocalizedDescription) =>
					`${d.languageCode}:${d.description}`,
			)
			.join('|');

		if (
			currentLocDescMapped !== originalLocDescMapped ||
			currentLocDesc.length !== originalLocDesc.length
		) {
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
		const originalTagIds = b.tags.map((t) => t.id);
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
		const originalAuthorIds = b.authors.map((a) => a.id);
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
		const originalSensitiveIds = b.sensitiveContent.map((s) => s.id);
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

		if (this.close()) {
			this.close()({ id: b.id, data: updatedData });
		}
	}

	onCancel(): void {
		if (this.close()) {
			this.close()(null);
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
