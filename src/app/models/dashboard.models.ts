export interface DashboardOverview {
    authors: number;
    books: number;
    chapters: number;
    pages: number;
    sensitiveContent: number;
    tags: number;
}

export interface DashboardProgress {
    totalChapters: number;
    processingChapters: number;
    books: {
        id: string;
        title: string;
        cover: string;
        processingChapters: number;
        totalChapters: number;
    }[];
}
