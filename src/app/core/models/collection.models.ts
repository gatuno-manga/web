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
	description?: string;
}

export interface ShareCollectionDto {
	collaboratorId: string;
}

export interface AddBookToCollectionDto {
	bookId: string;
}
