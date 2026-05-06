import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export interface Author {
    id: string;
    name: string;
    type?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthorsService {
    constructor(private readonly http: HttpClient) {}

    getAll(): Observable<Author[]> {
        return this.http.get<Author[]>('authors');
    }
}
