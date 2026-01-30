import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Tag, TagsPageOptions } from "../models/tags.models";
import { SensitiveContentService } from "./sensitive-content.service";
import { UserTokenService } from "./user-token.service";
import { DownloadService } from "./download.service";
import { from } from "rxjs";
import { catchError, map } from "rxjs/operators";

@Injectable({
    providedIn: 'root'
})
export class TagsService {
    constructor(
        private readonly http: HttpClient,
        private readonly sensitiveContentService: SensitiveContentService,
        private readonly userTokenService: UserTokenService,
        private readonly downloadService: DownloadService
    ) {}

    getTags(options?: TagsPageOptions) {
        const opts = { ...options };

        if (!opts.sensitiveContent)
            opts.sensitiveContent = this.sensitiveContentService.getContentAllow();

        if (!this.userTokenService.hasValidAccessToken)
            opts.sensitiveContent = [];
        
        return this.http.get<Tag[]>('tags', { params: { ...opts } }).pipe(
            catchError((err) => {
                console.warn('Online tags fetch failed, falling back to offline mode', err);
                return from(this.downloadService.getAllBooks()).pipe(
                    map(books => {
                        // 1. Filtrar livros por Conteúdo Sensível para mostrar apenas tags relevantes
                        // Recarrega as preferências se estiver offline
                        const allowedContent = this.sensitiveContentService.getContentAllow();
                        
                        const visibleBooks = books.filter(book => {
                            if (!book.sensitiveContent || book.sensitiveContent.length === 0) return true;
                            return book.sensitiveContent.every(sc => 
                                allowedContent.includes(sc.name) || allowedContent.includes(sc.id)
                            );
                        });

                        // 2. Extrair Tags
                        const allTags = new Map<string, Tag>();
                        visibleBooks.forEach(book => {
                            (book.tags || []).forEach(t => {
                                if (!allTags.has(t.id)) {
                                    allTags.set(t.id, {
                                        id: t.id,
                                        name: t.name,
                                        description: '' // Offline books don't store tag descriptions
                                    });
                                }
                            });
                        });
                        
                        return Array.from(allTags.values()).sort((a, b) => a.name.localeCompare(b.name));
                    })
                );
            })
        );
    }

    getAllTags() {
        return this.http.get<Tag[]>('tags').pipe(
            catchError(() => {
                return this.getTags({});
            })
        );
    }

    mergeTags(tagId: string, tagsToMerge: string[]) {
        return this.http.patch(`tags/${tagId}/merge`, tagsToMerge);
    }
}