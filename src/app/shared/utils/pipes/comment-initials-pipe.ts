import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'commentInitials',
	standalone: true,
})
export class CommentInitialsPipe implements PipeTransform {
	transform(userName: string | null | undefined): string {
		const normalized = (userName || '').trim();
		if (!normalized) return '?';

		const parts = normalized.split(/\s+/).filter(Boolean);
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
	}
}
