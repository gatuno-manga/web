import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Book, BookList, Chapter } from "../models/booke.models";

@Injectable({
    providedIn: 'root'
})
export class BookService {
    constructor(private http: HttpClient) {}

    getBooks() {
        return this.http.get<BookList[]>('books');
    }

    getBook(id: string) {
        return this.http.get<Book>(`books/${id}`);
    }

    getChapter(id: string, chapter: string) {
        return this.http.get<Chapter>(`books/${id}/chapters/${chapter}`);
    }
}
