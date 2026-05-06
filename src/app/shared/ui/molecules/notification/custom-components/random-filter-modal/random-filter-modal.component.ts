import { Component, Input, signal } from '@angular/core';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { SwitchComponent } from '@ui/atoms/inputs/switch/switch.component';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

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
    styleUrls: ['./random-filter-modal.component.scss']
})
export class RandomFilterModalComponent {
    @Input() close!: (result: RandomFilterResult | null) => void;

    randomizeTags = signal<boolean>(true);
    randomizeTypes = signal<boolean>(false);
    randomizeSensitive = signal<boolean>(false);

    confirm(): void {
        if (this.close) {
            this.close({
                tags: this.randomizeTags(),
                types: this.randomizeTypes(),
                sensitive: this.randomizeSensitive()
            });
        }
    }

    cancel(): void {
        if (this.close) {
            this.close(null);
        }
    }
}
