import { PageRequest } from "./miscellaneous.models";

export interface BookList {
  id: string;
  title: string;
  tags: tag[];
  cover: string;
  description: string;
  scrapingStatus: ScrapingStatus;
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
}

export interface BookDetail {
  alternativeTitle: string[];
  originalUrl: string[];
  scrapingStatus: ScrapingStatus;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface Author {
  id: string;
  name: string;
}

export interface tag {
  id: string;
  name: string;
}

export interface Chapterlist {
  id: string;
  title: string;
  originalUrl: string;
  scrapingStatus: ScrapingStatus;
  index: number;
  read: boolean;
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
}

export interface Cover {
  id: string;
  url: string;
  selected: boolean;
  title: string;
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
}
