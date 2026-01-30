export interface BookEvent {
    id: string;
    title: string;
    type?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ChapterEvent {
    bookId: string;
    chapters?: Array<{
        id: string;
        title: string;
        index: number;
        scrapingStatus: string;
    }>;
    chapter?: {
        id: string;
        title: string;
        index: number;
        scrapingStatus: string;
    };
    chapterIds?: string[];
}

export interface CoverEvent {
    bookId: string;
    coverId: string;
    url?: string;
}

export interface ScrapingEvent {
    chapterId: string;
    bookId: string;
    pagesCount?: number;
    error?: string;
}

export interface NewChaptersEvent {
    bookId: string;
    newChaptersCount: number;
    chapters: Array<{
        id: string;
        title: string;
        index: number;
    }>;
}

export interface UpdateStartedEvent {
    bookId: string;
    bookTitle: string;
    jobId: string;
    timestamp: number;
}

export interface UpdateCompletedEvent {
    bookId: string;
    bookTitle: string;
    jobId: string;
    newChapters: number;
    newCovers: number;
    timestamp: number;
}

export interface UpdateFailedEvent {
    bookId: string;
    bookTitle: string;
    jobId: string;
    error: string;
    timestamp: number;
}

export interface SubscriptionResponse {
    type: 'book' | 'chapter';
    id: string;
    success: boolean;
    error?: string;
}

export interface SubscriptionsListResponse {
    books: string[];
    chapters: string[];
    isAdmin: boolean;
}
