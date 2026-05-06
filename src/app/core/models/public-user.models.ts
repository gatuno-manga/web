import { BookBasic, Chapter, Page } from './book.models';

export interface PublicUserProfile {
	id: string;
	userName: string;
	name: string | null;
	profileImageUrl: string;
	profileBannerUrl: string;
	createdAt: string;
}

export interface PublicUserCollection {
	id: string;
	title: string;
	description: string | null;
	books: BookBasic[];
	createdAt: string;
	updatedAt: string;
}

export interface PublicUserSavedPage {
	id: string;
	page: Page;
	chapter: Chapter;
	book: BookBasic;
	comment?: string;
	createdAt: string;
}
