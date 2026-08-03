import {
	ChangeDetectionStrategy,
	Component,
	signal,
	input,
} from '@angular/core';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { SwitchComponent } from '@ui/atoms/inputs/switch/switch.component';

export interface RandomFilterResult {
	tags: boolean;
	types: boolean;
	sensitive: boolean;
}

@Component({
	selector: 'app-random-filter-modal',
	standalone: true,
	imports: [ButtonComponent, SwitchComponent, IconsComponent],
	templateUrl: './random-filter-modal.component.html',
	styleUrls: ['./random-filter-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RandomFilterModalComponent {
	close = input<(result: RandomFilterResult | null) => void>();

	randomizeTags = signal<boolean>(true);
	randomizeTypes = signal<boolean>(false);
	randomizeSensitive = signal<boolean>(false);

	confirm(): void {
		const closeFunc = this.close();
		if (closeFunc) {
			closeFunc({
				tags: this.randomizeTags(),
				types: this.randomizeTypes(),
				sensitive: this.randomizeSensitive(),
			});
		}
	}

	cancel(): void {
		const closeFunc = this.close();
		if (closeFunc) {
			closeFunc(null);
		}
	}
}
