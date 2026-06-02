import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'flag',
	standalone: true,
})
export class FlagPipe implements PipeTransform {
	private readonly flagMap: Record<string, string> = {
		'ja-jp': 'jp',
		'ko-kr': 'kr',
		'zh-cn': 'cn',
		'zh-tw': 'tw',
		'en-us': 'us',
		'en-gb': 'gb',
		'pt-br': 'br',
		'pt-pt': 'pt',
		'es-es': 'es',
		'es-419': 'un',
		'fr-fr': 'fr',
		'it-it': 'it',
		'de-de': 'de',
		'ru-ru': 'ru',
		'id-id': 'id',
		'th-th': 'th',
		'vi-vn': 'vn',
	};

	transform(languageCode: string | null | undefined): string {
		if (!languageCode) {
			return 'assets/flags/unknown.svg';
		}

		const normalizedCode = languageCode.trim().toLowerCase();
		const icon = this.flagMap[normalizedCode];
		if (icon) {
			return `assets/flags/${icon}.svg`;
		}

		return 'assets/flags/unknown.svg';
	}
}
