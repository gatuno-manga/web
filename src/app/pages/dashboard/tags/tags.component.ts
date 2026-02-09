import {
	Component,
	signal,
	inject,
	PLATFORM_ID,
	ChangeDetectorRef,
	NgZone,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TagsService } from '../../../service/tags.service';
import { Tag } from '../../../models/tags.models';
import { ListCheckboxComponent } from '../../../components/inputs/list-checkbox/list-checkbox.component';
import { ListCheckboxItem } from '../../../components/inputs/list-checkbox/list-checkbox.type';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { IconsComponent } from '../../../components/icons/icons.component';
import { MetaDataService } from '../../../service/meta-data.service';

@Component({
	selector: 'app-tags',
	imports: [ButtonComponent, ListCheckboxComponent, IconsComponent],
	templateUrl: './tags.component.html',
	styleUrl: './tags.component.scss',
})
export class TagsComponent {
	tags: Tag[] = [];
	isLoading = signal(true);
	mergingSelection: Tag | null = null;
	mergingTags: ListCheckboxItem[] = [];
	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);
	private cdr = inject(ChangeDetectorRef);
	private ngZone = inject(NgZone);

	constructor(
		private tagsService: TagsService,
		private metaService: MetaDataService,
	) {
		this.setMetaData();
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Tags | Dashboard',
			description: 'Gerencie suas tags.',
		});
	}

	ngOnInit() {
		if (this.isBrowser) {
			this.loadTags();
		}
	}

	loadTags() {
		this.tagsService.getTags().subscribe((tags) => {
			this.ngZone.run(() => {
				this.tags = tags;
				this.isLoading.set(false);
				this.cdr.detectChanges();
			});
		});
	}

	mergeSelect(tag: Tag) {
		this.mergingSelection = tag;
		this.mergingTags = this.tags
			.filter((t) => t.id !== tag.id)
			.map((t) => ({
				id: t.id,
				label: t.name,
				checked: false,
			}));
	}
	cancelMerge() {
		this.mergingSelection = null;
		this.mergingTags = [];
	}

	mergeTags() {
		if (!this.mergingSelection) return;

		const tags = this.mergingTags.filter((t) => t.checked).map((t) => t.id);
		this.tagsService
			.mergeTags(this.mergingSelection.id, tags)
			.subscribe(() => {
				this.ngZone.run(() => {
					this.loadTags();
					this.mergingSelection = null;
					this.cdr.detectChanges();
				});
			});
	}
}
