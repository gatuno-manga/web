import { Component, Input, signal } from '@angular/core';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { SwitchComponent } from '@components/inputs/switch/switch.component';

export interface RandomFilterResult {
    tags: boolean;
    types: boolean;
    sensitive: boolean;
}

@Component({
    selector: 'app-random-filter-modal',
    standalone: true,
    imports: [ButtonComponent, SwitchComponent],
    templateUrl: './random-filter-modal.component.html',
    styleUrls: ['./random-filter-modal.component.scss']
})
export class RandomFilterModalComponent {
    @Input() close!: (result: RandomFilterResult | null) => void;

    randomizeTags = signal<boolean>(true);
    randomizeTypes = signal<boolean>(false);
    randomizeSensitive = signal<boolean>(false);

    confirm() {
        if (this.close) {
            this.close({
                tags: this.randomizeTags(),
                types: this.randomizeTypes(),
                sensitive: this.randomizeSensitive()
            });
        }
    }

    cancel() {
        if (this.close) {
            this.close(null);
        }
    }
}
