import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
	PublicUserCollection,
	PublicUserProfile,
	PublicUserSavedPage,
} from '../models/public-user.models';

@Injectable({
	providedIn: 'root',
})
export class PublicUserService {
	constructor(private readonly http: HttpClient) {}

	getPublicProfile(userId: string): Observable<PublicUserProfile> {
		return this.http
			.get<{ data: PublicUserProfile }>(`users/${userId}/public/profile`)
			.pipe(map((res) => res.data));
	}

	getPublicCollections(userId: string): Observable<PublicUserCollection[]> {
		return this.http
			.get<{ data: PublicUserCollection[] }>(
				`users/${userId}/public/collections`,
			)
			.pipe(map((res) => res.data || []));
	}

	getPublicSavedPages(userId: string): Observable<PublicUserSavedPage[]> {
		return this.http
			.get<{ data: PublicUserSavedPage[] }>(
				`users/${userId}/public/saved-pages`,
			)
			.pipe(map((res) => res.data || []));
	}

	getPublicUserBundle(userId: string): Observable<{
		profile: PublicUserProfile;
		collections: PublicUserCollection[];
		savedPages: PublicUserSavedPage[];
	}> {
		return forkJoin({
			profile: this.getPublicProfile(userId),
			collections: this.getPublicCollections(userId),
			savedPages: this.getPublicSavedPages(userId),
		});
	}
}
