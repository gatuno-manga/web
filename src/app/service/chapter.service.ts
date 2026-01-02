import { Injectable } from "@angular/core";
import { Chapter } from "../models/book.models";
import { HttpClient } from "@angular/common/http";

interface BatchReadResult {
    chapterId: string;
    success: boolean;
    result?: any;
    error?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ChapterService {
    constructor(private http: HttpClient) {}

    getChapter(idChapter: string) {
        return this.http.get<Chapter>(`chapters/${idChapter}`);
    }

    resetChapter(idChapter: string) {
        return this.http.patch(`chapters/${idChapter}/reset`, {});
    }

    resetChapters(idChapters: string[]) {
        return this.http.patch(`chapters/reset`, idChapters);
    }

    markAsRead(idChapter: string) {
        return this.http.get(`chapters/${idChapter}/read`);
    }

    markAsUnread(idChapter: string) {
        return this.http.delete(`chapters/${idChapter}/read`);
    }

    markManyAsRead(chapterIds: string[]) {
        return this.http.post<BatchReadResult[]>(`chapters/batch/read`, chapterIds);
    }

    markManyAsUnread(chapterIds: string[]) {
        return this.http.post<BatchReadResult[]>(`chapters/batch/unread`, chapterIds);
    }
}
