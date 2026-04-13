import {
	Component,
	ChangeDetectionStrategy,
	inject,
	input,
	computed,
} from '@angular/core';
import { MetaDataService } from '../../../service/meta-data.service';
import { SearchService } from '../../../service/search.service';

@Component({
	selector: 'app-appearance',
	standalone: true,
	imports: [],
	templateUrl: './appearance.component.html',
	styleUrl: './appearance.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceComponent {
	private readonly metaService = inject(MetaDataService);
	private readonly searchService = inject(SearchService);

	isListView = input<boolean>(false);
	private globalSearchQuery = this.searchService.query;

	showPage = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return 'aparência visual tema cores layout'.includes(q);
	});

	constructor() {
		this.setMetaData();
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Aparência',
			description: 'Mude como as coisas do seu aplicativo se parecem.',
		});
	}
}
