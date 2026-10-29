import { Injectable } from '@angular/core';
import { APP_ICONS } from '@constants/icons.constant';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IconRegistryService {
	getIcon(name: string): Observable<string> {
		return of(APP_ICONS[name] || '');
	}
}
