import { Pipe, PipeTransform } from '@angular/core';
import { Chapter } from '@models/book.models';

@Pipe({
	name: 'chapterLabel',
	standalone: true,
})
export class ChapterLabelPipe implements PipeTransform {
	transform(chapter: Chapter): string {
		return chapter.title
			? `Capítulo ${chapter.index + 1} - ${chapter.title}`
			: `Capítulo ${chapter.index + 1}`;
	}
}
