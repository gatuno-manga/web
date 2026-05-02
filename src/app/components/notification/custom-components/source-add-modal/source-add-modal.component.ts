import { Component, Input, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { TextInputComponent } from '@components/inputs/text-input/text-input.component';
import { IconsComponent } from '@components/icons/icons.component';
import {
	CdkDragDrop,
	moveItemInArray,
	DragDropModule,
} from '@angular/cdk/drag-drop';

export interface SourceAddSaveEvent {
	urls: string[];
}

@Component({
	selector: 'app-source-add-modal',
	standalone: true,
	imports: [
		FormsModule,
		ButtonComponent,
		TextInputComponent,
		IconsComponent,
		DragDropModule,
	],
	templateUrl: './source-add-modal.component.html',
	styleUrls: ['./source-add-modal.component.scss'],
})
export class SourceAddModalComponent implements OnInit {
	@Input() existingUrls: string[] = [];
	@Input() close!: (result: SourceAddSaveEvent | null) => void;

	urls = signal<string[]>([]);
	newUrl = signal<string>('');
	urlError = signal<string>('');
	isLoading = signal<boolean>(false);

	ngOnInit(): void {
		this.urls.set([...this.existingUrls]);
	}

	isValid = computed(() => {
		return this.newUrl().trim().length > 0 && !this.urlError();
	});

	validateUrl(): boolean {
		this.urlError.set('');
		const url = this.newUrl().trim();

		if (!url) {
			return false;
		}

		try {
			const urlObj = new URL(url);
			if (!['http:', 'https:'].includes(urlObj.protocol)) {
				this.urlError.set('A URL deve começar com http:// ou https://');
				return false;
			}
		} catch {
			this.urlError.set('URL inválida. Exemplo: https://example.com/manga');
			return false;
		}

		const normalizedNewUrl = this.normalizeUrlForComparison(url);
		const isDuplicate = this.urls().some(
			(existingUrl) =>
				this.normalizeUrlForComparison(existingUrl) ===
				normalizedNewUrl,
		);

		if (isDuplicate) {
			this.urlError.set('Esta fonte já está na lista.');
			return false;
		}

		return true;
	}

	private normalizeUrlForComparison(url: string): string {
		try {
			const urlObj = new URL(url);
			return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${urlObj.search}${urlObj.hash}`
				.toLowerCase()
				.replace(/\/$/, '');
		} catch {
			return url.toLowerCase();
		}
	}

	addSource(): void {
		if (this.validateUrl()) {
			this.urls.update((current) => [...current, this.newUrl().trim()]);
			this.newUrl.set('');
			this.urlError.set('');
		}
	}

	removeSource(index: number): void {
		this.urls.update((current) => current.filter((_, i) => i !== index));
	}

	onDrop(event: CdkDragDrop<string[]>): void {
		this.urls.update((current) => {
			const next = [...current];
			moveItemInArray(next, event.previousIndex, event.currentIndex);
			return next;
		});
	}

	onSave(): void {
		this.isLoading.set(true);
		if (this.close) {
			this.close({ urls: this.urls() });
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
