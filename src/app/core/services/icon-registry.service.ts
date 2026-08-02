import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { APP_ICONS } from '../constants/icons.constant';

@Injectable({ providedIn: 'root' })
export class IconRegistryService {
	getIcon(name: string): Observable<string> {
		return of(APP_ICONS[name] || '');
	}
}
