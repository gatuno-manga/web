import e from "express";
import { PageRequest } from "./miscellaneous.models";

export interface BookList {
  id: string;
  title: string;
  cover: string;
  scrapingStatus: ScrapingStatus;
}

export enum ScrapingStatus {
  READY = 'ready',
  PROCESSING = 'process',
  ERROR = 'error',
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

export interface SensitiveContentResponse {
  id: string;
  name: string;
}
export interface TagResponse {
  id: string;
  name: string;
}

export interface Page {
  index: string;
  path: string;
}

export interface BookPageOptions extends PageRequest {
  sensitiveContent?: string[];
}
