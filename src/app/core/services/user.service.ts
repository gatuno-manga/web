import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Role, UserProfile } from '@models/user.models';
import { catchError, filter, map, of, switchMap, tap } from 'rxjs';
import { UserTokenService } from './user-token.service';

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

	hasPermission(permission: string | string[]): boolean {
		const profile = this.profileSignal();
		if (!profile) return false;

		// Admin bypassing permissions just in case
		if (profile.roles.includes(Role.ADMIN)) return true;

		const permissionsToCheck = Array.isArray(permission)
			? permission
			: [permission];

		return permissionsToCheck.some((p) => profile.permissions?.includes(p));
	}

	updateProfile(data: { userName?: string; name?: string }) {
		return this.http.patch<{ data: UserProfile }>('/users', data).pipe(
			map((res) => res.data),
			tap((profile) => this._profile.set(profile)),
		);
	}

	uploadAvatar(file: File) {
		const formData = new FormData();
		formData.append('file', file);

		return this.http
			.patch<{ data: UserProfile }>('/users/me/avatar', formData)
			.pipe(
				map((res) => res.data),
				tap((profile) => this._profile.set(profile)),
			);
	}

	uploadBanner(file: File) {
		const formData = new FormData();
		formData.append('file', file);

		return this.http
			.patch<{ data: UserProfile }>('/users/me/banner', formData)
			.pipe(
				map((res) => res.data),
				tap((profile) => this._profile.set(profile)),
			);
	}
}
