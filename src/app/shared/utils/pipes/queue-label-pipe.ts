import { Pipe, PipeTransform } from '@angular/core';

const QUEUE_LABELS: Record<string, string> = {
	'book-update-queue': 'Atualização de Livros',
	'chapter-scraping': 'Scraping de Capítulos',
	'cover-image-queue': 'Imagens de Capa',
	'fix-chapter-queue': 'Correção de Capítulos',
};

@Pipe({
	name: 'queueLabel',
	standalone: true,
})
export class QueueLabelPipe implements PipeTransform {
	transform(name: string): string {
		return QUEUE_LABELS[name] ?? name;
	}
}
