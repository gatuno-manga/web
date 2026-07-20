import { BookList } from './book.models';

export interface Collection {
	id: string;
	title: string;
	description?: string;
	isPublic: boolean;
	ownerId: string;
	books?: BookList[];
	collaboratorsCount?: number;
	bookCount?: number;
	booksCount?: number;
	_count?: {
		books?: number;
		collaborators?: number;
	};
	createdAt: string;
	updatedAt: string;
}

export interface CreateCollectionDto {
	id?: string;
	title: string;
	description?: string | null;
	isPublic?: boolean;
	coverUrl?: string | null;
}

export interface ShareCollectionDto {
	collaboratorId: string;
}

export interface AddBookToCollectionDto {
	bookId: string;
}
