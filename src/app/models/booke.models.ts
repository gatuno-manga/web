export interface BookList {
    id: string;
    title: string;
    scrapingStatus: ScrapingStatus;
}

export enum ScrapingStatus {
    READY = 'Ready',
    PROCESSING = 'Processing',
}

export interface Book {
    id: string;
    title: string;
    scrapingStatus: ScrapingStatus;
    chapters: Chapterlist[];
}

export interface Chapterlist {
    id: string;
    title: string;
    originalUrl: string;
    index: number;
}

export interface Chapter {
    id: string;
    title: string;
    originalUrl: string;
    index: number;
    pages: Page[];
}

export interface Page {
    index: string;
    path: string;
}
