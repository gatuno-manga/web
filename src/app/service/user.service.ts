import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, computed } from '@angular/core';
import { UserProfile } from '../models/user.models';
import { UserTokenService } from './user-token.service';
import { tap, catchError, of, filter, switchMap, map } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

@Injectable({
	providedIn: 'root',
})
export class UserService {
	private http = inject(HttpClient);
	private userTokenService = inject(UserTokenService);

	private _profile = signal<UserProfile | null>(null);
	public readonly profileSignal = this._profile.asReadonly();

	constructor() {
		// Fetch profile automatically when user becomes authenticated or if already authenticated
		toObservable(this.userTokenService.hasValidAccessTokenSignal)
			.pipe(
				filter((authenticated) => authenticated === true),
				switchMap(() => this.fetchMe()),
			)
			.subscribe();

		// Initial check if already authenticated
		if (this.userTokenService.hasValidAccessToken) {
			this.fetchMe().subscribe();
		}

		// Clear profile when logged out
		toObservable(this.userTokenService.hasValidAccessTokenSignal)
			.pipe(filter((authenticated) => authenticated === false))
			.subscribe(() => this._profile.set(null));
	}

	fetchMe() {
		return this.http.get<{ data: UserProfile }>('/users/me').pipe(
			map((res) => res.data),
			tap((profile) => this._profile.set(profile)),
			catchError(() => {
				this._profile.set(null);
				return of(null);
			}),
		);
	}
}
