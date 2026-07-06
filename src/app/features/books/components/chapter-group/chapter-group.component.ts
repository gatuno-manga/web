import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Chapterlist } from '@models/book.models';
import { ChapterIndexPipe } from '@shared/utils/pipes/chapter-index.pipe';

export interface ChapterGroupData {
	index: number;
	title?: string;
	chapters: Chapterlist[];
}

@Component({
	selector: 'app-chapter-group',
	standalone: true,
	imports: [ChapterIndexPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './chapter-group.component.html',
	styleUrl: './chapter-group.component.scss',
})
export class ChapterGroupComponent {
	group = input.required<ChapterGroupData>();
}
