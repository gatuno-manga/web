import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'timeAgo',
	standalone: true,
})
export class TimeAgoPipe implements PipeTransform {
	transform(timestamp: number | null | undefined): string {
		if (!timestamp) return '';
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) return `${hours}h atrás`;
		if (minutes > 0) return `${minutes}m atrás`;
		return `${seconds}s atrás`;
	}
}
