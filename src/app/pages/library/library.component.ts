import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	OnInit,
	signal,
} from '@angular/core';
import { BookList, ImageMetadata } from '@core/models/book.models';
import { ContextMenuItem } from '@core/models/context-menu.models';
import { BookService } from '@core/services/book.service';
import { CollectionService } from '@core/services/collection.service';
import { ContextMenuService } from '@core/services/context-menu.service';
import { ModalNotificationService } from '@core/services/modal-notification.service';
import { NotificationSeverity } from '@core/services/notification/notification-strategy.interface';
import { NotificationService } from '@core/services/notification.service';
import { BookGridComponent } from '@shared/ui/organisms/book-grid/book-grid.component';
import { IconButtonComponent } from '@ui/atoms/icon-button/icon-button.component';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';
import { CollectionEditModalComponent } from '@ui/molecules/notification/custom-components/collection-edit-modal/collection-edit-modal.component';
import { finalize } from 'rxjs';

export interface LibraryCollection {
	id: string;
	title: string;
	description?: string;
	visibility?: string;
	isSpecial?: boolean;
	books: string[] | BookList[];
	bookCovers?: {
		url: string;
		isMain?: boolean;
		metadata?: ImageMetadata;
	}[][];
	coverUrl?: string | null;
	bookCount: number;
	isPublic?: boolean;
}

interface GraphQlLibraryResponse {
	data: {
		myFavorites?: {
			data: {
				book: Partial<BookList> & {
					cover?: string;
					covers?: {
						url: string;
						isMain?: boolean;
						metadata?: {
							blurHash?: string;
							dominantColor?: string;
						};
					}[];
				};
			}[];
		};
		myCollections?: {
			data: {
				id: string;
				title: string;
				description?: string;
				visibility?: string;
				coverUrl?: string;
				books?: string[] | BookList[];
				bookCovers?: {
					url: string;
					isMain?: boolean;
					metadata?: ImageMetadata;
				}[][];
			}[];
		};
	};
}

const LIBRARY_QUERY = `
	query GetLibrary {
		myCollections(limit: 50) {
			data {
				id
				title
				description
				visibility
				coverUrl
				books
				bookCovers(limit: 4) {
					url
					isMain
					metadata {
						blurHash
						dominantColor
					}
				}
			}
		}
		myFavorites(limit: 50) {
			data {
				book {
					id
					title
					covers {
						url
						isMain
						metadata {
							blurHash
							dominantColor
						}
					}
				}
			}
		}
	}
`;

@Component({
	selector: 'app-library',
	standalone: true,
	imports: [
		CommonModule,
		BookGridComponent,
		IconsComponent,
		BlurhashComponent,
		IconButtonComponent,
	],
	templateUrl: './library.component.html',
	styleUrl: './library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit {
	private http = inject(HttpClient);
	private bookService = inject(BookService);
	private contextMenuService = inject(ContextMenuService);
	private modalService = inject(ModalNotificationService);
	private notificationService = inject(NotificationService);
	private collectionService = inject(CollectionService);

	collections = signal<LibraryCollection[]>([]);
	selectedCollection = signal<LibraryCollection | null>(null);
	selectedBooks = signal<BookList[]>([]);
	isLoading = signal(true);
	isLoadingBooks = signal(false);
	error = signal<string | null>(null);

	ngOnInit() {
		this.fetchData();
	}

	private fetchData() {
		this.isLoading.set(true);
		this.error.set(null);

		this.http
			.post<GraphQlLibraryResponse>('graphql', { query: LIBRARY_QUERY })
			.pipe(finalize(() => this.isLoading.set(false)))
			.subscribe({
				next: (res) => {
					const data = res.data;
					const libraryList: LibraryCollection[] = [];

					// 1. Map Favorites
					if (data?.myFavorites?.data) {
						const favoriteBooks: BookList[] =
							data.myFavorites.data.map((fav) => {
								const b = fav.book;
								const covers = b.covers;
								const mainCover =
									covers?.find((c) => c.isMain) ||
									covers?.[0];
								return {
									...b,
									cover: mainCover?.url || b.cover,
									metadata: mainCover?.metadata,
									blurHash: mainCover?.metadata?.blurHash,
									dominantColor:
										mainCover?.metadata?.dominantColor,
								} as BookList;
							});

						libraryList.push({
							id: 'favorites',
							title: 'Favoritos',
							description:
								'Todos os seus livros marcados como favoritos',
							isSpecial: true,
							books: favoriteBooks,
							bookCount: favoriteBooks.length,
							bookCovers: favoriteBooks
								.map((b) => [
									{
										url: b.cover,
										metadata: b.coverMetadata,
										isMain: true,
									},
								])
								.slice(0, 4),
						});
					}

					// 2. Map Collections
					if (data?.myCollections?.data) {
						const collections = data.myCollections.data.map(
							(c) => ({
								id: c.id,
								title: c.title,
								description: c.description,
								visibility: c.visibility,
								isPublic: c.visibility === 'PUBLIC',
								coverUrl: c.coverUrl,
								isSpecial: false,
								books: c.books || [],
								bookCount: (c.books || []).length,
								bookCovers: c.bookCovers || [],
							}),
						);
						libraryList.push(...collections);
					}

					this.collections.set(libraryList);
				},
				error: (err) => {
					console.error('Erro ao buscar biblioteca via GraphQL', err);
					this.error.set(
						'Não foi possível carregar a biblioteca. Tente novamente mais tarde.',
					);
				},
			});
	}

	selectCollection(collection: LibraryCollection) {
		this.selectedCollection.set(collection);

		if (collection.isSpecial) {
			// Favoritos já vieram com os livros completos do GraphQL
			this.selectedBooks.set(collection.books as BookList[]);
			return;
		}

		if (!collection.books || collection.books.length === 0) {
			this.selectedBooks.set([]);
			return;
		}

		// Para coleções, os books são apenas IDs, precisamos buscar os dados reais
		this.isLoadingBooks.set(true);

		this.bookService
			.getBooks({ ids: collection.books as string[] })
			.pipe(finalize(() => this.isLoadingBooks.set(false)))
			.subscribe({
				next: (res) => {
					this.selectedBooks.set(res.data as BookList[]);
				},
				error: (err) => {
					console.error('Erro ao buscar livros da coleção', err);
					this.selectedBooks.set([]);
				},
			});
	}

	clearSelection() {
		this.selectedCollection.set(null);
		this.selectedBooks.set([]);
	}

	getCovers(
		bookCovers: {
			url: string;
			isMain?: boolean;
			metadata?: ImageMetadata;
		}[][],
	) {
		if (!bookCovers || bookCovers.length === 0) return [];
		return bookCovers
			.filter((book) => book && book.length > 0)
			.map((book) => book.find((c) => c.isMain) || book[0])
			.slice(0, 4);
	}

	openContextMenu(event: MouseEvent, collection: LibraryCollection) {
		console.log('Context menu triggered for:', collection.title);
		event.preventDefault();
		event.stopPropagation();

		const items: ContextMenuItem[] = [];

		if (collection.isSpecial) {
			items.push({
				label: 'Compartilhar Favoritos',
				icon: 'share',
				action: () => this.shareCollection(collection),
			});
		} else {
			items.push(
				{
					label: 'Editar Coleção',
					icon: 'edit',
					action: () => this.editCollection(collection),
				},
				{
					label: 'Compartilhar',
					icon: 'share',
					action: () => this.shareCollection(collection),
				},
				{ type: 'separator' },
				{
					label: 'Excluir',
					icon: 'trash',
					danger: true,
					action: () => this.deleteCollection(collection),
				},
			);
		}

		this.contextMenuService.open(event, items);
	}

	editCollection(collection: LibraryCollection) {
		this.notificationService.notify({
			message: '',
			level: 'custom',
			severity: NotificationSeverity.CRITICAL,
			component: CollectionEditModalComponent,
			componentData: {
				initialData: {
					title: collection.title,
					description: collection.description || '',
					isPublic: collection.isPublic || false,
					coverUrl: collection.coverUrl || '',
				},
				close: (
					newData: {
						title: string;
						description: string;
						isPublic: boolean;
						coverUrl: string;
						coverFile?: File | null;
					} | null,
				) => {
					this.modalService.close();
					if (!newData) return;

					const hasChanges =
						newData.title !== collection.title ||
						newData.description !== collection.description ||
						newData.isPublic !== collection.isPublic ||
						newData.coverUrl !== collection.coverUrl;

					const updateDetails = () => {
						if (!hasChanges) {
							if (newData.coverFile) {
								this.notificationService.success(
									'Coleção atualizada com sucesso!',
								);
								this.collectionService
									.getMyCollections()
									.subscribe();
							}
							return;
						}

						const payload: {
							title: string;
							isPublic?: boolean;
							description?: string | null;
							coverUrl?: string | null;
						} = {
							title: newData.title,
							isPublic: newData.isPublic,
						};

						if (newData.description !== undefined) {
							payload.description = newData.description;
						}

						if (newData.coverUrl !== undefined) {
							payload.coverUrl = newData.coverUrl;
						}

						if (
							newData.coverUrl !== collection.coverUrl &&
							!newData.coverFile
						) {
							payload.coverUrl =
								newData.coverUrl.trim() === ''
									? null
									: newData.coverUrl;
						}

						this.collectionService
							.updateCollection(collection.id, payload)
							.subscribe({
								next: () => {
									this.notificationService.success(
										'Coleção atualizada com sucesso!',
									);
									if (newData.coverFile) {
										this.collectionService
											.getMyCollections()
											.subscribe();
									} else {
										this.collections.update((cols) =>
											cols.map((c) =>
												c.id === collection.id
													? { ...c, ...newData }
													: c,
											),
										);
										if (
											this.selectedCollection()?.id ===
											collection.id
										) {
											this.selectedCollection.update(
												(c) =>
													c
														? { ...c, ...newData }
														: c,
											);
										}
									}
								},
								error: () =>
									this.notificationService.error(
										'Erro ao atualizar coleção',
									),
							});
					};

					if (newData.coverFile) {
						this.collectionService
							.uploadCover(collection.id, newData.coverFile)
							.subscribe({
								next: () => updateDetails(),
								error: () =>
									this.notificationService.error(
										'Erro ao fazer upload da capa',
									),
							});
					} else {
						updateDetails();
					}
				},
			},
		});
	}

	shareCollection(collection: LibraryCollection) {
		const shareUrl = `${window.location.origin}/collection/${collection.id}`;
		navigator.clipboard
			.writeText(shareUrl)
			.then(() => {
				this.notificationService.success(
					'Link copiado para a área de transferência!',
				);
			})
			.catch(() => {
				this.notificationService.error('Erro ao copiar o link');
			});
	}

	deleteCollection(collection: LibraryCollection) {
		this.modalService.show(
			'Excluir Coleção',
			`Tem certeza que deseja excluir a coleção "${collection.title}"?`,
			[
				{
					label: 'Cancelar',
					type: 'primary',
					callback: () => this.modalService.close(),
				},
				{
					label: 'Excluir',
					type: 'danger',
					callback: () => {
						this.collectionService
							.deleteCollection(collection.id)
							.subscribe({
								next: () => {
									this.notificationService.success(
										'Coleção excluída com sucesso!',
									);
									this.collections.update((cols) =>
										cols.filter(
											(c) => c.id !== collection.id,
										),
									);
									if (
										this.selectedCollection()?.id ===
										collection.id
									) {
										this.clearSelection();
									}
									this.modalService.close();
								},
								error: () => {
									this.notificationService.error(
										'Erro ao excluir a coleção',
									);
									this.modalService.close();
								},
							});
					},
				},
			],
		);
	}
}
