export interface DashboardOverview {
    counts: {
        books: number;
        chapters: number;
        users: number;
        pages: number;
        tags: number;
        authors: number;
        sensitiveContent: number;
    };
    status: {
        books: { status: string; count: number }[];
        chapters: { status: string; count: number }[];
    };
    sensitiveContent: { name: string; count: number }[];
    tags: { name: string; count: number }[];
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
