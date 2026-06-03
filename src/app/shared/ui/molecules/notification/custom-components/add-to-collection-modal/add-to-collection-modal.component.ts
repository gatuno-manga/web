import {
	ChangeDetectionStrategy,
	Component,
	inject,
	input,
	OnInit,
	output,
	signal,
} from '@angular/core';
import { CollectionService } from '@core/services/collection.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';

@Component({
	selector: 'app-add-to-collection-modal',
	imports: [IconsComponent, ButtonComponent],
	templateUrl: './add-to-collection-modal.component.html',
	styleUrl: './add-to-collection-modal.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToCollectionModalComponent implements OnInit {
	private readonly collectionService = inject(CollectionService);

	bookId = input.required<string>();
	bookTitle = input.required<string>();
	close = output<boolean>();

	collections = this.collectionService.myCollections;
	isLoading = signal(true);

	ngOnInit() {
		this.collectionService.getMyCollections().subscribe({
			next: () => this.isLoading.set(false),
			error: () => this.isLoading.set(false),
		});
	}

	onClose() {
		this.close.emit(false);
	}

	addToCollection(collectionId: string) {
		this.collectionService
			.addBookToCollection(collectionId, { bookId: this.bookId() })
			.subscribe({
				next: () => this.close.emit(true),
				error: (err) => {
					console.error('Erro ao adicionar livro à coleção:', err);
				},
			});
	}
}
