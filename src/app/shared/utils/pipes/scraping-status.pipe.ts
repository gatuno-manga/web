import { Pipe, PipeTransform } from '@angular/core';
import { ScrapingStatus } from '@models/book.models';

@Pipe({
	name: 'scrapingStatus',
	standalone: true,
})
export class ScrapingStatusPipe implements PipeTransform {
	transform(status: ScrapingStatus | undefined | null): string {
		switch (status) {
			case ScrapingStatus.READY:
				return 'Pronto';
			case ScrapingStatus.PROCESSING:
				return 'Processando';
			case ScrapingStatus.ERROR:
				return 'Erro';
			default:
				return '';
		}
	}
}
