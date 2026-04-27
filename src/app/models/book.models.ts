import { PageRequest } from './miscellaneous.models';

export interface BookList {
	id: string;
	title: string;
	tags: tag[];
	cover: string;
	description: string;
	scrapingStatus: ScrapingStatus;
	authors?: Author[];
	totalChapters?: number;
	blurHash?: string;
	dominantColor?: string;
	metadata?: ImageMetadata;
}

export interface ImageMetadata {
	blurHash?: string;
	dominantColor?: string;
	height: number;
	width: number;
	mimeType?: string;
	sizeBytes?: number;
}

export enum ScrapingStatus {
	READY = 'ready',
	PROCESSING = 'process',
	ERROR = 'error',
}

export enum TypeBook {
	MANGA = 'manga',
	MANHWA = 'manhwa',
	MANHUA = 'manhua',
	COMIC = 'comic',
	NOVEL = 'novel',
	OTHER = 'other',
}

export interface BookBasic {
	id: string;
	title: string;
	cover: string;
	description: string;
	publication: number;
	scrapingStatus: ScrapingStatus;
	autoUpdate: boolean;
	tags: tag[];
	sensitiveContent: SensitiveContentResponse[];
	totalChapters: number;
	authors: Author[];
	blurHash?: string;
	dominantColor?: string;
	metadata?: ImageMetadata;
}

export interface BookDetail {
	alternativeTitle: string[];
	originalUrl: string[];
	scrapingStatus: ScrapingStatus;
	createdAt: Date;
	updatedAt: Date;
}

export interface UpdateBookDto {
	title?: string;
	description?: string;
	publication?: number;
	alternativeTitle?: string[];
	originalUrl?: string[];
	type?: TypeBook;
}

export interface Book {
	id: string;
	title: string;
	cover: string;
	description: string;
	publication: number;
	scrapingStatus: ScrapingStatus;
	chapters: Chapterlist[];
	tags: tag[];
	sensitiveContent: SensitiveContentResponse[];
	authors: Author[];
	blurHash?: string;
	dominantColor?: string;
	metadata?: ImageMetadata;
}

export interface Author {
	id: string;
	name: string;
}

export interface tag {
	id: string;
	name: string;
}

export const ContentTypes = {
	IMAGE: 'image',
	TEXT: 'text',
	DOCUMENT: 'document',
} as const;

export type ContentType = 'image' | 'text' | 'document';
export type ContentFormat = 'markdown' | 'html' | 'plain';
export type DocumentFormat = 'pdf' | 'epub';

export interface Chapterlist {
	id: string;
	title: string;
	originalUrl: string;
	scrapingStatus?: ScrapingStatus | null;
	index: number;
	read?: boolean;
	contentType?: ContentType;
}

export interface ChapterCursorPage {
	data: Chapterlist[];
	nextCursor: string | null;
	hasNextPage: boolean;
}

export interface ChapterCursorOptions {
	cursor?: string;
	limit?: number;
	order?: 'ASC' | 'DESC';
}

export interface Chapter {
	id: string;
	title: string;
	originalUrl: string;
	index: number;
	pages: Page[];
	previous?: string;
	next?: string;
	bookId: string;
	bookTitle: string;
	totalChapters: number;
	// Multi-format support
	contentType: ContentType;
	content?: string;
	contentFormat?: ContentFormat;
	documentPath?: string;
	documentFormat?: DocumentFormat;
}

export interface ChapterCommentNode {
	id: string;
	chapterId: string;
	userId: string;
	userName: string;
	profileImageUrl: string;
	parentId: string | null;
	content: string;
	isPublic: boolean;
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
	replies: ChapterCommentNode[];
}

export interface ChapterCommentsPageOptions {
	page: number;
	limit: number;
	maxDepth: number;
}

export interface Cover {
	id: string;
	url: string;
	selected: boolean;
	title: string;
	blurHash?: string;
	metadata?: ImageMetadata;
}

export interface SensitiveContentResponse {
	id: string;
	name: string;
}
export interface TagResponse {
	id: string;
	name: string;
}

export interface Page {
	id?: number;
	index: string;
	path: string;
	blurHash?: string;
	metadata?: ImageMetadata;
}

export interface BookPageOptions extends PageRequest {
	type?: TypeBook[];
	sensitiveContent?: string[];
	search?: string;
	tags?: string[];
	tagsLogic?: 'and' | 'or';
	excludeTags?: string[];
	excludeTagsLogic?: 'and' | 'or';
	publication?: number;
	publicationOperator?: 'eq' | 'gt' | 'lt' | 'gte' | 'lte';
	authors?: string[];
	authorsLogic?: 'and' | 'or';
	orderBy?: 'title' | 'createdAt' | 'updatedAt' | 'publication';
	order?: 'ASC' | 'DESC';
	random?: boolean;
}

export interface BookFilterInput {
	authors?: string[];
	authorsLogic?: 'AND' | 'OR';
	cursor?: string;
	excludeTags?: string[];
	excludeTagsLogic?: 'AND' | 'OR';
	limit?: number;
	order?: 'ASC' | 'DESC';
	orderBy?: 'CREATED_AT' | 'PUBLICATION' | 'TITLE' | 'UPDATED_AT';
	page?: number;
	publication?: number;
	publicationOperator?: 'EQ' | 'GT' | 'GTE' | 'LT' | 'LTE';
	search?: string;
	sensitiveContent?: string[];
	tags?: string[];
	tagsLogic?: 'AND' | 'OR';
	type?: string[];
}

export interface PaginatedBookResponse {
	data: BookList[];
	hasNextPage?: boolean;
	lastPage?: number;
	nextCursor?: string;
	page?: number;
	total?: number;
}
