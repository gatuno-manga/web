import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'chapterLabel',
	standalone: true,
})
export class ChapterLabelPipe implements PipeTransform {
	transform(chapter: any): string {
		return chapter.title
			? `Capítulo ${chapter.index + 1} - ${chapter.title}`
			: `Capítulo ${chapter.index + 1}`;
	}
}
