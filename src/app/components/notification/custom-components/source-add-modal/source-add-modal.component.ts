import { Component, Input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { TextInputComponent } from '@components/inputs/text-input/text-input.component';
import { IconsComponent } from '@components/icons/icons.component';

export interface SourceAddSaveEvent {
    url: string;
}

@Component({
    selector: 'app-source-add-modal',
    standalone: true,
    imports: [FormsModule, ButtonComponent, TextInputComponent, IconsComponent],
    templateUrl: './source-add-modal.component.html',
    styleUrls: ['./source-add-modal.component.scss']
})
export class SourceAddModalComponent {
    @Input() existingUrls: string[] = [];
    @Input() close!: (result: SourceAddSaveEvent | null) => void;

    newUrl = signal<string>('');
    urlError = signal<string>('');
    isLoading = signal<boolean>(false);

    isValid = computed(() => {
        return this.newUrl().trim().length > 0 && !this.urlError();
    });

    validateUrl(): boolean {
        this.urlError.set('');
        const url = this.newUrl().trim();

        if (!url) {
            this.urlError.set('Por favor, insira uma URL.');
            return false;
        }

        try {
            const urlObj = new URL(url);
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                this.urlError.set('A URL deve começar com http:// ou https://');
                return false;
            }
        } catch {
            this.urlError.set('URL inválida. Exemplo: https://example.com/manga');
            return false;
        }

        const normalizedNewUrl = this.normalizeUrlForComparison(url);
        const isDuplicate = this.existingUrls.some(existingUrl =>
            this.normalizeUrlForComparison(existingUrl) === normalizedNewUrl
        );

        if (isDuplicate) {
            this.urlError.set('Esta fonte já foi adicionada.');
            return false;
        }

        return true;
    }

    private normalizeUrlForComparison(url: string): string {
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${urlObj.search}${urlObj.hash}`
                .toLowerCase()
                .replace(/\/$/, '');
        } catch {
            return url.toLowerCase();
        }
    }

    onSave(): void {
        if (this.validateUrl()) {
            this.isLoading.set(true);
            if (this.close) {
                this.close({ url: this.newUrl().trim() });
            }
        }
    }

    onCancel(): void {
        if (this.close) {
            this.close(null);
        }
    }
}
