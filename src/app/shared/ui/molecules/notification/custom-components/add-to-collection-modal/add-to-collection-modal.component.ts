import {
	ChangeDetectionStrategy,
	Component,
	inject,
	input,
	OnInit,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CollectionService } from '@core/services/collection.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';

@Component({
	selector: 'app-add-to-collection-modal',
	imports: [IconsComponent, ButtonComponent, FormsModule, TextInputComponent],
	templateUrl: './add-to-collection-modal.component.html',
	styleUrl: './add-to-collection-modal.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToCollectionModalComponent implements OnInit {
	private readonly collectionService = inject(CollectionService);

	bookId = input.required<string>();
	bookTitle = input.required<string>();
	close = input.required<(success: boolean) => void>();

	collections = this.collectionService.myCollections;
	isLoading = signal(true);
	isCreating = signal(false);
	isSubmitting = signal(false);
	newCollectionTitle = signal('');

	ngOnInit() {
		this.collectionService.getMyCollections().subscribe({
			next: () => this.isLoading.set(false),
			error: () => this.isLoading.set(false),
		});
	}

	onClose() {
		this.close()(false);
	}

	addToCollection(collectionId: string) {
		this.collectionService
			.addBookToCollection(collectionId, { bookId: this.bookId() })
			.subscribe({
				next: () => this.close()(true),
				error: (err) => {
					console.error('Erro ao adicionar livro à coleção:', err);
				},
			});
	}

	toggleCreate() {
		this.isCreating.update((v) => !v);
		this.newCollectionTitle.set('');
	}

	createCollection() {
		const title = this.newCollectionTitle().trim();
		if (!title) return;

		this.isSubmitting.set(true);
		this.collectionService
			.createCollection({ title, description: '' })
			.subscribe({
				next: (collection) => {
					this.isSubmitting.set(false);
					// Adiciona o livro automaticamente à nova coleção criada
					this.addToCollection(collection.id);
				},
				error: (err) => {
					console.error('Erro ao criar coleção:', err);
					this.isSubmitting.set(false);
				},
			});
	}
}
