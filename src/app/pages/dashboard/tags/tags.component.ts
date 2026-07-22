import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectorRef,
	Component,
	computed,
	inject,
	NgZone,
	PLATFORM_ID,
	signal,
} from '@angular/core';
import { MetaDataService } from '@core/services/meta-data.service';
import { TagsService } from '@core/services/tags.service';
import { Tag } from '@models/tags.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { ListCheckboxComponent } from '@ui/atoms/inputs/list-checkbox/list-checkbox.component';
import { ListCheckboxItem } from '@ui/atoms/inputs/list-checkbox/list-checkbox.type';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
	selector: 'app-tags',
	imports: [ButtonComponent, ListCheckboxComponent, IconsComponent, FormsModule, RouterLink],
	templateUrl: './tags.component.html',
	styleUrl: './tags.component.scss',
})
export class TagsComponent {
	tags: Tag[] = [];
	
	searchQuery = signal('');
	filteredTags = computed(() => {
		const search = this.searchQuery().toLowerCase();
		if (!search) return this.tags;
		return this.tags.filter(t => t.name.toLowerCase().includes(search));
	});

	isLoading = signal(true);
	mergingSelection: Tag | null = null;
	mergingTags: ListCheckboxItem[] = [];

	mergeSearchQuery = signal('');
	filteredMergingTags = computed(() => {
		const search = this.mergeSearchQuery().toLowerCase();
		if (!search) return this.mergingTags;
		return this.mergingTags.filter(t => t.label.toLowerCase().includes(search));
	});

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
		this.mergeSearchQuery.set('');
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
