import {
	CdkDragDrop,
	DragDropModule,
	moveItemInArray,
} from '@angular/cdk/drag-drop';
import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectorRef,
	Component,
	computed,
	inject,
	NgZone,
	PLATFORM_ID,
	signal,
	ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MetaDataService } from '@core/services/meta-data.service';
import { SensitiveContentService } from '@core/services/sensitive-content.service';
import { SensitiveContentResponse } from '@models/book.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { ListCheckboxComponent } from '@ui/atoms/inputs/list-checkbox/list-checkbox.component';
import { ListCheckboxItem } from '@ui/atoms/inputs/list-checkbox/list-checkbox.type';
import { TooltipDirective } from '@ui/atoms/tooltip/tooltip.directive';

@Component({
	selector: 'app-sensitive-content',
	standalone: true,
	imports: [
		ButtonComponent,
		ListCheckboxComponent,
		IconsComponent,
		FormsModule,
		RouterLink,
		DragDropModule,
		TooltipDirective,
	],
	templateUrl: './sensitive-content.component.html',
	styleUrl: './sensitive-content.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SensitiveContentComponent {
	sensitiveContents = signal<SensitiveContentResponse[]>([]);
	filteredContents = computed(() => {
		const search = this.searchQuery().toLowerCase();
		const contents = this.sensitiveContents();
		if (!search) return contents;
		return contents.filter((c) => c.name.toLowerCase().includes(search));
	});

	searchQuery = signal('');
	isLoading = signal(true);

	mergingSelection: SensitiveContentResponse | null = null;
	mergingTags: ListCheckboxItem[] = [];

	mergeSearchQuery = signal('');
	filteredMergingTags = computed(() => {
		const search = this.mergeSearchQuery().toLowerCase();
		if (!search) return this.mergingTags;
		return this.mergingTags.filter((t) =>
			t.label.toLowerCase().includes(search),
		);
	});

	isCreating = false;
	newContentName = '';

	editingId: string | null = null;
	editContentName = '';
	editContentWeight = 0;

	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);
	private cdr = inject(ChangeDetectorRef);
	private ngZone = inject(NgZone);

	constructor(
		private sensitiveContentService: SensitiveContentService,
		private metaService: MetaDataService,
	) {
		this.setMetaData();
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Conteúdos Sensíveis | Dashboard',
			description: 'Gerencie seus conteúdos sensíveis.',
		});
	}

	ngOnInit() {
		if (this.isBrowser) {
			this.loadSensitiveContents();
		}
	}

	loadSensitiveContents() {
		this.isLoading.set(true);
		this.sensitiveContentService
			.getSensitiveContent()
			.subscribe((contents) => {
				this.ngZone.run(() => {
					// Sort items descending by weight so highest weight is at the top
					const sorted = contents.sort(
						(a, b) => (b.weight || 0) - (a.weight || 0),
					);
					this.sensitiveContents.set(sorted);
					this.isLoading.set(false);
					this.cdr.detectChanges();
				});
			});
	}

	onDrop(event: CdkDragDrop<SensitiveContentResponse[]>) {
		if (event.previousIndex === event.currentIndex) return;

		const currentContents = [...this.sensitiveContents()];
		moveItemInArray(
			currentContents,
			event.previousIndex,
			event.currentIndex,
		);

		const total = currentContents.length;
		const batchItems: Partial<SensitiveContentResponse>[] = [];

		currentContents.forEach((item, index) => {
			const newWeight = total - index;
			if (item.weight !== newWeight) {
				item.weight = newWeight;
				batchItems.push({ id: item.id, weight: newWeight });
			}
		});

		if (batchItems.length > 0) {
			this.sensitiveContentService
				.updateSensitiveContentBatch(batchItems)
				.subscribe();
		}

		this.sensitiveContents.set(currentContents);
	}

	startCreate() {
		this.isCreating = true;
		this.newContentName = '';
		this.cancelEdit();
	}

	cancelCreate() {
		this.isCreating = false;
		this.newContentName = '';
	}

	createContent() {
		if (!this.newContentName.trim()) return;
		const nextWeight = this.sensitiveContents().length + 1;
		this.sensitiveContentService
			.createSensitiveContent(this.newContentName, nextWeight)
			.subscribe(() => {
				this.ngZone.run(() => {
					this.loadSensitiveContents();
					this.isCreating = false;
					this.newContentName = '';
					this.cdr.detectChanges();
				});
			});
	}

	startEdit(content: SensitiveContentResponse) {
		this.editingId = content.id;
		this.editContentName = content.name;
		this.editContentWeight = content.weight || 0;
		this.cancelCreate();
	}

	cancelEdit() {
		this.editingId = null;
		this.editContentName = '';
		this.editContentWeight = 0;
	}

	updateContent(id: string) {
		if (!this.editContentName.trim()) return;

		const maxWeight = this.sensitiveContents().length;
		let finalWeight = this.editContentWeight;
		if (finalWeight < 1) finalWeight = 1;
		if (finalWeight > maxWeight) finalWeight = maxWeight;

		this.sensitiveContentService
			.updateSensitiveContent(id, this.editContentName, finalWeight)
			.subscribe(() => {
				this.ngZone.run(() => {
					this.loadSensitiveContents();
					this.editingId = null;
					this.cdr.detectChanges();
				});
			});
	}

	deleteContent(id: string) {
		if (confirm('Tem certeza que deseja excluir este conteúdo sensível?')) {
			this.sensitiveContentService
				.deleteSensitiveContent(id)
				.subscribe(() => {
					this.ngZone.run(() => {
						this.loadSensitiveContents();
						this.cdr.detectChanges();
					});
				});
		}
	}

	mergeSelect(content: SensitiveContentResponse) {
		this.mergingSelection = content;
		this.mergingTags = this.sensitiveContents()
			.filter((t) => t.id !== content.id)
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

	mergeContents() {
		if (!this.mergingSelection) return;

		const selectedTags = this.mergingTags
			.filter((t) => t.checked)
			.map((t) => t.id);

		if (selectedTags.length === 0) return;

		this.sensitiveContentService
			.mergeSensitiveContent(this.mergingSelection.id, selectedTags)
			.subscribe(() => {
				this.ngZone.run(() => {
					this.loadSensitiveContents();
					this.mergingSelection = null;
					this.cdr.detectChanges();
				});
			});
	}
}
