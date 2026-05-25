import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	model,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';

export interface MultiSelectOption {
	id: string;
	name: string;
}

@Component({
	selector: 'app-multi-select-tags',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		TextInputComponent,
		IconsComponent,
		ButtonComponent,
	],
	templateUrl: './multi-select-tags.component.html',
	styleUrl: './multi-select-tags.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiSelectTagsComponent {
	options = input.required<MultiSelectOption[]>();
	selectedIds = model<string[]>([]);
	excludedIds = model<string[]>([]);

	allowExclude = input<boolean>(false);
	maxSelection = input<number | null>(null);
	placeholderSearch = input<string>('Filtrar...');
	limitDisplay = input<number>(15);
	groupSelectedAtTop = input<boolean>(false);

	searchQuery = signal('');

	filteredOptions = computed(() => {
		const query = this.searchQuery().toLowerCase().trim();
		const list = this.options();
		const selected = new Set(this.selectedIds());
		const excluded = new Set(this.excludedIds());

		let filtered = query
			? list.filter((opt) => opt.name.toLowerCase().includes(query))
			: list;

		if (this.groupSelectedAtTop()) {
			const active = filtered.filter(
				(opt) => selected.has(opt.id) || excluded.has(opt.id),
			);
			const inactive = filtered.filter(
				(opt) => !selected.has(opt.id) && !excluded.has(opt.id),
			);
			filtered = [...active, ...inactive];
		}

		return filtered.slice(0, this.limitDisplay());
	});

	// Items that are selected/excluded but NOT in the current filtered list
	activeItemsNotInFilter = computed(() => {
		if (this.groupSelectedAtTop()) return []; // Already handled in filteredOptions

		const filteredSet = new Set(this.filteredOptions().map((o) => o.id));
		const activeSet = new Set([
			...this.selectedIds(),
			...this.excludedIds(),
		]);

		return this.options().filter(
			(opt) => activeSet.has(opt.id) && !filteredSet.has(opt.id),
		);
	});

	toggleTag(id: string) {
		const selected = this.selectedIds();
		const excluded = this.excludedIds();

		if (selected.includes(id)) {
			// From Selected to Excluded (if allowed) or Neutral
			this.selectedIds.set(selected.filter((i) => i !== id));
			if (this.allowExclude()) {
				this.excludedIds.set([...excluded, id]);
			}
		} else if (excluded.includes(id)) {
			// From Excluded to Neutral
			this.excludedIds.set(excluded.filter((i) => i !== id));
		} else {
			// From Neutral to Selected
			const totalActive = selected.length + excluded.length;
			if (this.maxSelection() && totalActive >= this.maxSelection()!) {
				// Reached limit, maybe emit warning? For now just block.
				return;
			}
			this.selectedIds.set([...selected, id]);
		}
	}

	isTagSelected(id: string): boolean {
		return this.selectedIds().includes(id);
	}

	isTagExcluded(id: string): boolean {
		return this.excludedIds().includes(id);
	}
}
