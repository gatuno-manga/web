import { Component, Input, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { BookList } from '../../models/book.models';
import { IconsComponent } from '../icons/icons.component';
import { ContextMenuService } from '../../service/context-menu.service';
import { DownloadService } from '../../service/download.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { NotificationService } from '../../service/notification.service';
import { BookService } from '../../service/book.service';
import { ContextMenuItem } from '../../models/context-menu.models';
import { firstValueFrom } from 'rxjs';
import { ChapterService } from '../../service/chapter.service';

@Component({
	selector: 'app-item-book',
	standalone: true,
	imports: [RouterModule, IconsComponent],
	templateUrl: './item-book.component.html',
	styleUrl: './item-book.component.scss',
})
export class ItemBookComponent {
	@Input() book!: BookList;
	@Input() type: 'grid' | 'list' | 'cover' = 'grid';

	private contextMenuService = inject(ContextMenuService);
	private downloadService = inject(DownloadService);
	private modalService = inject(ModalNotificationService);
	private notificationService = inject(NotificationService);
	private bookService = inject(BookService);
	private chapterService = inject(ChapterService);

	imageError = false;

	onImageError() {
		this.imageError = true;
	}

	onContextMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		const items: ContextMenuItem[] = [
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

		// Check if book is downloaded to add delete option
		this.downloadService
			.isBookDownloaded(this.book.id)
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
			`Deseja baixar todos os capítulos do livro "${this.book.title}"?`,
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
				this.bookService.getChapters(this.book.id),
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
				this.bookService.getBook(this.book.id),
			);
			if (!fullBook) throw new Error('Book not found');

			this.modalService.close(); // Close the initial 'Aguarde' modal or confirmation modal if any
			this.notificationService.info(
				`Baixando ${chapters.length} capítulos em segundo plano.`,
				'Download iniciado',
			);

			// Background download logic similar to BookComponent
			const delay = (ms: number) =>
				new Promise((resolve) => setTimeout(resolve, ms));

			let downloadedCount = 0;
			for (const chapterInfo of chapters) {
				try {
					const isDownloaded =
						await this.downloadService.isChapterDownloaded(
							chapterInfo.id,
						);
					if (isDownloaded) continue;

					const fullChapter = await firstValueFrom(
						this.chapterService.getChapter(chapterInfo.id),
					);
					if (!fullChapter) continue;

					await this.downloadService.downloadChapter(
						fullBook,
						fullChapter,
					);
					downloadedCount++;
					await delay(500); // Small delay to be nice
				} catch (e) {
					console.error('Error downloading chapter', e);
				}
			}

			this.modalService.close();
			this.notificationService.success(
				`${downloadedCount} novos capítulos baixados de "${this.book.title}".`,
				'Download concluído',
			);
		} catch (e) {
			console.error('Error starting download', e);
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
			`Deseja excluir o livro "${this.book.title}" dos downloads?`,
			[
				{ label: 'Cancelar', type: 'primary' },
				{
					label: 'Excluir',
					type: 'danger',
					callback: async () => {
						await this.downloadService.deleteBook(this.book.id);
						this.modalService.close();
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
		const url = `${window.location.origin}/books/${this.book.id}`;
		if (navigator.share) {
			navigator
				.share({
					title: this.book.title,
					text: this.book.description,
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
}
