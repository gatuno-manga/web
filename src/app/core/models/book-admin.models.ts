import { Chapterlist, TypeBook } from './book.models';

export interface CreateBookDto {
	title: string;
	alternativeTitles?: { title: string; languageCode?: string }[];
	originalLanguageCode?: string;
	type?: TypeBook;
	tags?: string[];
	authors?: { name: string }[];
	originalUrl?: string[];
	ignoreConflict?: boolean;
}

export interface BookVerificationResult {
	id: string;
	title: string;
	status: 'valid' | 'invalid' | 'warning';
	issues: string[];
}

export interface DeletedBookItem {
	id: string;
	title: string;
	deletedAt: string;
	scheduledDeletionAt: string;
}

export interface OfflineSyncData {
	bookId: string;
	chapters: Chapterlist[];
	lastUpdate: string;
}

export interface ChapterReorderItem {
	id: string;
	index: number;
}

export interface BookTitleCheckResult {
	conflict: boolean;
	existingBook?: { id: string; title: string };
	conflictingBooks?: { id: string; title: string }[];
}
