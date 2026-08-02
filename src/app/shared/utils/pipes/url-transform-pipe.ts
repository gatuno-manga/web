import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'urlTransform',
	standalone: true,
})
export class UrlTransformPipe implements PipeTransform {
	transform(url: string): string {
		try {
			return new URL(url).hostname;
		} catch (_e) {
			return url;
		}
	}
}
