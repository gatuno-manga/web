import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { SwitchComponent } from '@ui/atoms/inputs/switch/switch.component';
import { TextAreaComponent } from '@ui/atoms/inputs/text-area/text-area.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';
import { FileInputComponent } from '@ui/molecules/file-input/file-input.component';

export interface CollectionEditData {
	title: string;
	description: string;
	isPublic: boolean;
	coverUrl: string;
	coverFile?: File | null;
}

@Component({
	selector: 'app-collection-edit-modal',
	standalone: true,
	imports: [
		FormsModule,
		ButtonComponent,
		TextAreaComponent,
		TextInputComponent,
		SwitchComponent,
		FileInputComponent,
	],
	templateUrl: './collection-edit-modal.component.html',
	styleUrls: ['./collection-edit-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionEditModalComponent {
	initialData = input.required<CollectionEditData>();
	close = input.required<(data: CollectionEditData | null) => void>();

	title = signal<string>('');
	description = signal<string>('');
	isPublic = signal<boolean>(false);
	coverUrl = signal<string>('');
	coverFile = signal<File | null>(null);

	isValid = computed(() => this.title().trim().length > 0);

	constructor() {
		// Can't read inputs in constructor correctly if they are bound after creation in dynamic component,
		// but NotificationService sets them before ngOnInit. Wait, it's better to use an effect or just `ngOnInit`
	}

	ngOnInit() {
		const data = this.initialData();
		this.title.set(data.title || '');
		this.description.set(data.description || '');
		this.isPublic.set(data.isPublic || false);
		this.coverUrl.set(data.coverUrl || '');
	}

	onFileSelected(file: File | null) {
		this.coverFile.set(file);
		if (!file) {
			this.coverUrl.set('');
		}
	}

	confirm(): void {
		const closeFn = this.close();
		if (closeFn && this.isValid()) {
			closeFn({
				title: this.title(),
				description: this.description(),
				isPublic: this.isPublic(),
				coverUrl: this.coverUrl(),
				coverFile: this.coverFile(),
			});
		}
	}

	cancel(): void {
		const closeFn = this.close();
		if (closeFn) {
			closeFn(null);
		}
	}
}
