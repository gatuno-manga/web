import { CommonModule, Location, NgOptimizedImage } from '@angular/common';
import {
	ChangeDetectorRef,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { ChapterService } from '@core/services/chapter.service';
import { ContextMenuService } from '@core/services/context-menu.service';
import { DownloadService } from '@core/services/download.service';
import { ModalNotificationService } from '@core/services/modal-notification.service';
import { NotificationService } from '@core/services/notification.service';
import { UserTokenService } from '@core/services/user-token.service';
import { BookList } from '@models/book.models';
import { ContextMenuItem } from '@models/context-menu.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { BlurhashComponent } from '@ui/molecules/blurhash/blurhash.component';
import { firstValueFrom } from 'rxjs';
import { ImageFallbackDirective } from '@ui/directives/image-fallback.directive';

@Component({
	selector: 'app-item-book',
	standalone: true,
	imports: [
		RouterModule,
		NgOptimizedImage,
		BlurhashComponent,
		CommonModule,
		IconsComponent,
		ImageFallbackDirective,
	],
	templateUrl: './item-book.component.html',
	styleUrl: './item-book.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemBookComponent {
	book = input.required<BookList>();
	type = input<'grid' | 'list' | 'cover'>('grid');
	priority = input(false);
	progress = input<{
		currentChapterTitle?: string;
		nextChapterTitle?: string;
		nextChapterId?: string;
		pageIndex?: number;
	}>();
	canRemove = input(false);
	remove = output<void>();

	private contextMenuService = inject(ContextMenuService);
	private downloadService = inject(DownloadService);
	private modalService = inject(ModalNotificationService);
	private notificationService = inject(NotificationService);
	private bookService = inject(BookService);
	private chapterService = inject(ChapterService);
	public userTokenService = inject(UserTokenService);
	private cdr = inject(ChangeDetectorRef);
	private router = inject(Router);
	private location = inject(Location);

	isImageLoaded = signal(false);
	isDownloaded = signal(false);

	// Fetch dynamic progress updates from DownloadService
	downloadProgress = signal<
		import('@core/models/offline.models').DownloadProgress[]
	>([]);
	isDownloadingBook = signal(false);
	downloadingTotalChapters = signal(0);
	downloadingCurrentChapter = signal(0);

	isDownloading = computed(() => {
		const progresses = this.downloadProgress() || [];
		const isProgressing = progresses.some(
			(p) => p.status === 'downloading' || p.status === 'pending',
		);
		return this.isDownloadingBook() || isProgressing;
	});

	downloadPercent = computed(() => {
		const progresses = this.downloadProgress() || [];

		if (this.isDownloadingBook()) {
			const totalChapters = this.downloadingTotalChapters();
			if (totalChapters === 0) return 0;

			const currentChapIdx = this.downloadingCurrentChapter();
			const activeProgress = progresses.find(
				(p) => p.status === 'downloading',
			);
			let currentChapPercent = 0;
			if (activeProgress && activeProgress.total > 0) {
				currentChapPercent =
					activeProgress.current / activeProgress.total;
			}

			return (
				((currentChapIdx + currentChapPercent) / totalChapters) * 100
			);
		}

		if (progresses.length === 0) return 0;
		const total = progresses.reduce(
			(acc, curr) => acc + (curr.total || 0),
			0,
		);
		const current = progresses.reduce(
			(acc, curr) => acc + (curr.current || 0),
			0,
		);
		return total > 0 ? (current / total) * 100 : 0;
	});

	dashOffset = computed(() => {
		// Circular progress ring length is ~70
		const percent = this.downloadPercent();
		return 70 - (70 * percent) / 100;
	});

	constructor() {
		effect(() => {
			const bookId = this.book()?.id;
			if (bookId) {
				this.downloadService
					.isBookDownloaded(bookId)
					.then((downloaded) => this.isDownloaded.set(downloaded));
			}
		});

		effect((onCleanup) => {
			const bookId = this.book()?.id;
			if (bookId) {
				const sub = this.downloadService
					.getBookDownloadProgress(bookId)
					.subscribe((progresses) => {
						this.downloadProgress.set(progresses);
					});
				onCleanup(() => sub.unsubscribe());
			}
		});
	}

	onRemove(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		this.remove.emit();
	}

	cardCoverStyle = computed(() => {
		if (
			this.book().cover &&
			!(this.book().blurHash || this.book().coverMetadata?.blurHash)
		) {
			return { '--card-cover': `url(${this.book().cover})` };
		}
		return {};
	});

	truncatedDescription = computed(() => {
		const desc = this.book()?.description?.toString() || '';
		if (desc.length > 150) {
			return `${desc.substring(0, 150)}...`;
		}
		return desc;
	});

	truncatedTitle = computed(() => {
		const title = this.book()?.title?.toString() || '';
		if (title.length > 80) {
			return `${title.substring(0, 80)}...`;
		}
		return title;
	});

	onImageLoad() {
		this.isImageLoaded.set(true);
	}

	isBlobUrl(url: string | undefined | null): boolean {
		return typeof url === 'string' && url.startsWith('blob:');
	}

	onContextMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		const items: ContextMenuItem[] = [
			{
				label: 'Abrir em nova aba',
				icon: 'link',
				action: () => {
					const urlTree = this.router.createUrlTree([
						'/books',
						this.book().id,
					]);
					const url = this.location.prepareExternalUrl(
						this.router.serializeUrl(urlTree),
					);
					window.open(window.location.origin + url, '_blank');
				},
			},
			{
				label: 'Baixar Livro',
				icon: 'download',
				action: () => this.downloadBook(),
			},
			{
				label: 'Compartilhar',
				icon: 'share',
				action: () => this.shareBook(),
			},
		];

		if (this.userTokenService.isAdminSignal()) {
			items.push(
				{ type: 'separator' },
				{
					label: 'Corrigir Capas',
					icon: 'refresh-ccw',
					action: () => this.fixCovers(),
				},
			);
		}

		// Check if book is downloaded to add delete option
		this.downloadService
			.isBookDownloaded(this.book().id)
			.then((isDownloaded) => {
				if (isDownloaded) {
					items.push(
						{ type: 'separator' },
						{
							label: 'Excluir Download',
							icon: 'trash',
							danger: true,
							action: () => this.deleteDownloadedBook(),
						},
					);
				}
				this.contextMenuService.open(event, items);
			});
	}

	downloadBook() {
		this.modalService.show(
			'Baixar Livro',
			`Deseja baixar todos os capítulos do livro "${this.book().title}"?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Baixar',
					type: 'danger',
					callback: () => this.confirmDownloadBook(),
				},
			],
			'info',
		);
	}

	private async confirmDownloadBook() {
		try {
			this.modalService.show(
				'Aguarde',
				'Iniciando download...',
				[],
				'info',
			);

			// We need the full book details to download properly if we only have BookList
			// But DownloadService.downloadChapter takes 'Book' which has 'chapters'.
			// BookList doesn't have chapters.
			// So we fetch chapters.
			const chapters = await firstValueFrom(
				this.bookService.getAllChapters(this.book().id),
			);

			if (chapters.length === 0) {
				this.modalService.show(
					'Erro',
					'Este livro não possui capítulos.',
					[{ label: 'Ok', type: 'primary' }],
					'error',
				);
				return;
			}

			// Convert BookList to Book-like object or fetch full book if needed.
			// Ideally we should fetch full book metadata.
			const fullBook = await firstValueFrom(
				this.bookService.getBook(this.book().id),
			);
			if (!fullBook) throw new Error('Book not found');

			this.modalService.close(); // Close the initial 'Aguarde' modal or confirmation modal if any
			this.isDownloadingBook.set(true);
			this.downloadingTotalChapters.set(chapters.length);
			this.downloadingCurrentChapter.set(0);
			this.cdr.markForCheck();

			this.notificationService.info(
				`Baixando ${chapters.length} capítulos em segundo plano.`,
				'Download iniciado',
			);

			// Background download logic similar to BookComponent
			const delay = (ms: number) =>
				new Promise((resolve) => setTimeout(resolve, ms));

			let currentIdx = 0;
			let downloadedCount = 0;
			for (const chapterInfo of chapters) {
				this.downloadingCurrentChapter.set(currentIdx);
				this.cdr.markForCheck();
				try {
					const isDownloaded =
						await this.downloadService.isChapterDownloaded(
							chapterInfo.id,
						);
					if (isDownloaded) {
						currentIdx++;
						continue;
					}

					const fullChapter = await firstValueFrom(
						this.chapterService.getChapter(chapterInfo.id),
					);
					if (!fullChapter) {
						currentIdx++;
						continue;
					}

					await this.downloadService.downloadChapter(
						fullBook,
						fullChapter,
					);
					downloadedCount++;
					currentIdx++;
					await delay(500); // Small delay to be nice
				} catch (e) {
					console.error('Error downloading chapter', e);
				}
			}

			this.downloadingCurrentChapter.set(chapters.length);
			this.modalService.close();
			this.isDownloadingBook.set(false);
			this.isDownloaded.set(true);
			this.cdr.markForCheck();
			this.notificationService.success(
				`${downloadedCount} novos capítulos baixados de "${this.book().title}".`,
				'Download concluído',
			);
		} catch (e) {
			console.error('Error starting download', e);
			this.isDownloadingBook.set(false);
			this.cdr.markForCheck();
			this.modalService.show(
				'Erro',
				'Erro ao iniciar download.',
				[{ label: 'Ok', type: 'primary' }],
				'error',
			);
		}
	}

	deleteDownloadedBook() {
		this.modalService.show(
			'Excluir Download',
			`Deseja excluir o livro "${this.book().title}" dos downloads?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Excluir',
					type: 'danger',
					callback: async () => {
						await this.downloadService.deleteBook(this.book().id);
						this.modalService.close();
						this.isDownloaded.set(false);
						this.notificationService.success(
							'Livro removido dos downloads.',
						);
					},
				},
			],
			'warning',
		);
	}

	shareBook() {
		const url = `${window.location.origin}/books/${this.book().id}`;
		if (navigator.share) {
			navigator
				.share({
					title: this.book().title,
					text: this.book().description,
					url: url,
				})
				.catch(console.error);
		} else {
			navigator.clipboard.writeText(url).then(() => {
				this.notificationService.success(
					'Link copiado para a área de transferência.',
					'Link copiado',
				);
			});
		}
	}

	fixCovers() {
		this.modalService.show(
			'Corrigir Capas',
			`Deseja tentar corrigir automaticamente as capas do livro "${this.book().title}"?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Corrigir',
					type: 'danger',
					callback: () => {
						this.bookService
							.fixAllCovers(this.book().id)
							.subscribe({
								next: () => {
									this.notificationService.success(
										'Tarefa de correção de capas agendada.',
										'Processando',
									);
									this.modalService.close();
								},
								error: (err) => {
									console.error('Error fixing covers:', err);
									this.notificationService.error(
										'Erro ao agendar correção de capas.',
									);
									this.modalService.close();
								},
							});
					},
				},
			],
			'info',
		);
	}
}
