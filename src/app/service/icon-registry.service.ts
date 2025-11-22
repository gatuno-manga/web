import { Injectable, inject, makeStateKey, TransferState, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { map, Observable, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IconRegistryService {
    private http = inject(HttpClient);
    private transferState = inject(TransferState);
    private platformId = inject(PLATFORM_ID);

    private iconCache = new Map<string, string>();

    getIcon(name: string): Observable<string> {
        if (this.iconCache.has(name)) {
            return of(this.iconCache.get(name)!);
        }

        const KEY = makeStateKey<string>(`SVG_ICON_${name}`);

        if (this.transferState.hasKey(KEY)) {
            const svg = this.transferState.get(KEY, '');
            this.iconCache.set(name, svg);
            return of(svg);
        }

        const path = `/assets/icons/${name}.svg`;

        return this.http.get(path, { responseType: 'text' }).pipe(
            tap(svg => {
                this.iconCache.set(name, svg);
                if (isPlatformServer(this.platformId)) {
                    this.transferState.set(KEY, svg);
                }
            }),
            map(svg => svg || '')
        );
    }
}
