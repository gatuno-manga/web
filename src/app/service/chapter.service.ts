import { Injectable } from "@angular/core";
import { Chapter } from "../models/book.models";
import { HttpClient } from "@angular/common/http";

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
}
