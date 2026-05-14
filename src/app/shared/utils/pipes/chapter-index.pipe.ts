import { inject, Pipe, PipeTransform } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SettingsService } from '@core/services/settings.service';

@Pipe({
	name: 'chapterIndex',
	standalone: true,
})
export class ChapterIndexPipe implements PipeTransform {
	private settingsService = inject(SettingsService);
	private settings = toSignal(this.settingsService.settings$, {
		initialValue: this.settingsService.getSettings(),
	});

	transform(value: number | string | undefined | null): string {
		if (value === undefined || value === null) return '';

		const index =
			typeof value === 'number' ? value : Number.parseFloat(value);
		if (Number.isNaN(index)) return String(value);

		const separator = this.settings().decimalSeparator || ',';
		return index.toString().replace('.', separator);
	}
}
