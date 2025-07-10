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
  PROCESSING = 'processing',
  ERROR = 'error',
}

export enum SensitiveContent {
  GORE = 'gore',
  SUGGESTIVE = 'suggestive',
  EROTIC = 'erotic',
  PORNOGRAFIC = 'pornografic',
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
  sensitiveContent: SensitiveContent[];
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

export interface Page {
  index: string;
  path: string;
}

export interface BookPageOptions extends PageRequest {}
