import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/inputs/button/button.component';
import { TextInputComponent } from '@components/inputs/text-input/text-input.component';
import { IconsComponent } from '../icons/icons.component';

export interface SourceAddSaveEvent {
    url: string;
}

@Component({
    selector: 'app-source-add-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonComponent, TextInputComponent, IconsComponent],
    templateUrl: './source-add-modal.component.html',
    styleUrl: './source-add-modal.component.scss'
})
export class SourceAddModalComponent {
    @Input() existingUrls: string[] = [];
    @Output() save = new EventEmitter<SourceAddSaveEvent>();
    @Output() cancel = new EventEmitter<void>();

    newUrl: string = '';
    urlError: string = '';
    isLoading: boolean = false;

    validateUrl(): boolean {
        this.urlError = '';

        if (!this.newUrl.trim()) {
            this.urlError = 'Por favor, insira uma URL.';
            return false;
        }

        // Validação de formato de URL
        try {
            const url = new URL(this.newUrl.trim());

            // Verificar se tem protocolo http ou https
            if (!['http:', 'https:'].includes(url.protocol)) {
                this.urlError = 'A URL deve começar com http:// ou https://';
                return false;
            }
        } catch {
            this.urlError = 'URL inválida. Exemplo: https://example.com/manga';
            return false;
        }

        // Verificar duplicatas (normalizar para comparação)
        const normalizedNewUrl = this.normalizeUrlForComparison(this.newUrl.trim());
        const isDuplicate = this.existingUrls.some(existingUrl =>
            this.normalizeUrlForComparison(existingUrl) === normalizedNewUrl
        );

        if (isDuplicate) {
            this.urlError = 'Esta fonte já foi adicionada.';
            return false;
        }

        return true;
    }

    private normalizeUrlForComparison(url: string): string {
        try {
            const urlObj = new URL(url);
            // Normalizar para comparação (remover trailing slash, converter para lowercase)
            return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${urlObj.search}${urlObj.hash}`
                .toLowerCase()
                .replace(/\/$/, ''); // Remover trailing slash
        } catch {
            return url.toLowerCase();
        }
    }

    onSave() {
        if (this.validateUrl()) {
            this.isLoading = true;
            this.save.emit({ url: this.newUrl.trim() });
        }
    }

    onCancel() {
        this.cancel.emit();
    }
}
