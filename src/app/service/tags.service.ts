import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Tag, TagsPageOptions } from "../models/tags.models";
import { SensitiveContentService } from "./sensitive-content.service";
import { UserTokenService } from "./user-token.service";

@Injectable({
    providedIn: 'root'
})
export class TagsService {
    constructor(
        private readonly http: HttpClient,
        private readonly sensitiveContentService: SensitiveContentService,
        private readonly userTokenService: UserTokenService
    ) {}

    getTags(options?: TagsPageOptions) {
        const opts = { ...options };

        if (!opts.sensitiveContent)
            opts.sensitiveContent = this.sensitiveContentService.getContentAllow();

        if (!this.userTokenService.hasValidAccessToken)
            opts.sensitiveContent = [];
        return this.http.get<Tag[]>('tags', { params: { ...opts } });
    }

    getAllTags() {
        return this.http.get<Tag[]>('tags');
    }

    mergeTags(tagId: string, tagsToMerge: string[]) {
        return this.http.patch(`tags/${tagId}/merge`, tagsToMerge);
    }
}
