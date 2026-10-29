import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	ChapterCommentNode,
	ChapterCommentsPageOptions,
} from '@models/book.models';
import { Paginated } from '@models/miscellaneous.models';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class ChapterCommentsService {
	constructor(private http: HttpClient) {}

	listChapterComments(
		chapterId: string,
		options: ChapterCommentsPageOptions,
	): Observable<Paginated<ChapterCommentNode>> {
		const params = new URLSearchParams();
		params.set('page', String(options.page));
		params.set('limit', String(options.limit));
		params.set('maxDepth', String(options.maxDepth));

		return this.http.get<Paginated<ChapterCommentNode>>(
			`chapters/${chapterId}/comments?${params.toString()}`,
		);
	}

	createComment(
		chapterId: string,
		content: string,
	): Observable<ChapterCommentNode> {
		return this.http.post<ChapterCommentNode>(
			`chapters/${chapterId}/comments`,
			{
				content,
			},
		);
	}

	createReply(
		chapterId: string,
		parentId: string,
		content: string,
	): Observable<ChapterCommentNode> {
		return this.http.post<ChapterCommentNode>(
			`chapters/${chapterId}/comments/${parentId}/replies`,
			{ content },
		);
	}

	updateComment(
		chapterId: string,
		commentId: string,
		content: string,
	): Observable<ChapterCommentNode> {
		return this.http.patch<ChapterCommentNode>(
			`chapters/${chapterId}/comments/${commentId}`,
			{ content },
		);
	}

	deleteComment(
		chapterId: string,
		commentId: string,
	): Observable<{ message: string }> {
		return this.http.delete<{ message: string }>(
			`chapters/${chapterId}/comments/${commentId}`,
		);
	}
}
