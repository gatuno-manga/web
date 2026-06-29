import {
	CdkDragDrop,
	DragDropModule,
	moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	AlternativeTitle,
	BookBasic,
	BookDetail,
	UpdateBookDto,
} from '@models/book.models';
import { FlagPipe } from '@shared/utils/pipes/flag.pipe';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { SelectComponent } from '@ui/atoms/inputs/select/select.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';

export interface BookAltTitlesSaveEvent {
	id: string;
	data: UpdateBookDto;
}

@Component({
	selector: 'app-book-alt-titles-modal',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ButtonComponent,
		TextInputComponent,
		SelectComponent,
		IconsComponent,
		DragDropModule,
		FlagPipe,
	],
	templateUrl: './book-alt-titles-modal.component.html',
	styleUrls: ['./book-alt-titles-modal.component.scss'],
})
export class BookAltTitlesModalComponent implements OnInit {
	@Input() book!: BookBasic;
	@Input() close!: (result: BookAltTitlesSaveEvent | null) => void;

	isSaving = signal(false);
	alternativeTitles = signal<AlternativeTitle[]>([]);

	newAltTitle = signal('');
	newLanguageCode = signal<string>('');

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
		const bookDetail = this.book as BookBasic & BookDetail;
		this.alternativeTitles.set([...(bookDetail.alternativeTitles || [])]);

		if (
			this.alternativeTitles().length === 0 &&
			bookDetail.alternativeTitle &&
			bookDetail.alternativeTitle.length > 0
		) {
			this.alternativeTitles.set(
				bookDetail.alternativeTitle.map((t: string) => ({
					title: t,
					languageCode: '',
					rank: 0,
				})),
			);
		}
	}

	addAltTitle(): void {
		const val = this.newAltTitle().trim();
		if (val && !this.alternativeTitles().find((t) => t.title === val)) {
			this.alternativeTitles.update((prev) => [
				...prev,
				{
					title: val,
					languageCode: this.newLanguageCode(),
					rank: prev.length,
				},
			]);
			this.newAltTitle.set('');
		}
	}

	removeAltTitle(index: number): void {
		this.alternativeTitles.update((prev) =>
			prev.filter((_, i) => i !== index),
		);
	}

	updateAltTitleLang(index: number, lang: string): void {
		this.alternativeTitles.update((prev) => {
			const next = [...prev];
			next[index].languageCode = lang;
			return next;
		});
	}

	onAltTitleDrop(event: CdkDragDrop<AlternativeTitle[]>): void {
		this.alternativeTitles.update((prev) => {
			const next = [...prev];
			moveItemInArray(next, event.previousIndex, event.currentIndex);
			return next;
		});
	}

	onSave(): void {
		this.isSaving.set(true);

		const bookDetail = this.book as BookBasic & BookDetail;
		const currentAltTitles = this.alternativeTitles();
		const originalAltTitles = bookDetail.alternativeTitles || [];

		const currentAltTitlesMapped = currentAltTitles
			.map((t) => `${t.languageCode || ''}:${t.title}`)
			.join('|');
		const originalAltTitlesMapped = originalAltTitles
			.map((t) => `${t.languageCode || ''}:${t.title}`)
			.join('|');

		if (
			currentAltTitlesMapped !== originalAltTitlesMapped ||
			currentAltTitles.length !== originalAltTitles.length
		) {
			const updatedData: UpdateBookDto = {
				alternativeTitles: currentAltTitles.map((t, index) => ({
					...t,
					languageCode: t.languageCode === '' ? null : t.languageCode,
					rank: index,
				})),
			};
			if (this.close) {
				this.close({ id: this.book.id, data: updatedData });
			}
		} else {
			this.onCancel();
		}
	}

	onCancel(): void {
		if (this.close) {
			this.close(null);
		}
	}
}
