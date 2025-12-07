import { BookBasic, Chapter, Page } from './book.models';

export interface CreateSavedPageDto {
    pageId: number;
    chapterId: string;
    bookId: string;
    comment?: string;
}

export interface SavedPage {
    id: string;
    page: Page;
    chapter: Chapter;
    book: BookBasic;
    comment?: string;
    createdAt: Date;
}