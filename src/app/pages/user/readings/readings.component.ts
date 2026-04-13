import {
	Component,
	ChangeDetectionStrategy,
	inject,
	input,
} from '@angular/core';
import { MetaDataService } from '../../../service/meta-data.service';
import { ReaderSettingsFormComponent } from '../../../components/readers';

@Component({
	selector: 'app-readings',
	standalone: true,
	imports: [ReaderSettingsFormComponent],
	templateUrl: './readings.component.html',
	styleUrl: './readings.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingsComponent {
	private readonly metaService = inject(MetaDataService);

	isListView = input<boolean>(false);
	searchQuery = input<string>('');

	constructor() {
		this.setMetaData();
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Leituras',
			description: 'Configure sua experiência de leitura.',
		});
	}
}
