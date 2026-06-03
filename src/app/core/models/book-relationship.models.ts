import { BookList } from './book.models';

export type RelationType =
	| 'sequence'
	| 'spin-off'
	| 'doujinshi'
	| 'same-franchise'
	| 'related'
	| 'adaptation'
	| 'crossover';

export interface RelatedBookItem {
	relationId: string;
	relationType: RelationType;
	isBidirectional: boolean;
	order: number | null;
	metadata: {
		note?: string;
		weight?: number;
	} | null;
	direction: 'incoming' | 'outgoing';
	relatedBook: BookList;
}

export interface BookRelationshipsPage {
	total: number;
	limit: number;
	offset: number;
	items: RelatedBookItem[];
}

export interface CreateBookRelationshipDto {
	targetBookId: string;
	relationType: RelationType;
	isBidirectional?: boolean;
	order?: number;
	note?: string;
	weight?: number;
}

export interface UpdateBookRelationshipDto {
	relationType?: RelationType;
	isBidirectional?: boolean;
	order?: number;
	note?: string;
	weight?: number;
}

export interface BookRelationshipQueryOptions {
	cursor?: string;
	types?: RelationType[];
	limit?: number;
	offset?: number;
}
