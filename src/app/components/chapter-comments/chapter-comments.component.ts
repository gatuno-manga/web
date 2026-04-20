import {
	Component,
	inject,
	input,
	signal,
	computed,
	DestroyRef,
	OnInit,
	ChangeDetectionStrategy,
	WritableSignal,
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs/operators';
import { MarkdownComponent } from 'ngx-markdown';

import { IconsComponent } from '../icons/icons.component';
import { ChapterCommentsService } from '../../service/chapter-comments.service';
import { UserTokenService } from '../../service/user-token.service';
import { UserService } from '../../service/user.service';
import { NotificationService } from '../../service/notification.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import {
	ChapterCommentNode,
} from '../../models/book.models';
import { Page as PaginatedResponse } from '../../models/miscellaneous.models';

type FlattenedComment = {
	comment: ChapterCommentNode;
	depth: number;
};

@Component({
	selector: 'app-chapter-comments',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		DecimalPipe,
		DatePipe,
		IconsComponent,
		MarkdownComponent,
	],
	templateUrl: './chapter-comments.component.html',
	styleUrl: './chapter-comments.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterCommentsComponent implements OnInit {
	private chapterCommentsService = inject(ChapterCommentsService);
	private userTokenService = inject(UserTokenService);
	private userService = inject(UserService);
	private notificationService = inject(NotificationService);
	private modalNotificationService = inject(ModalNotificationService);
	private router = inject(Router);
	private destroyRef = inject(DestroyRef);

	chapterId = input.required<string>();

	commentsLoading = signal<boolean>(false);
	commentsPage = signal<PaginatedResponse<ChapterCommentNode> | null>(null);
	flatComments = signal<FlattenedComment[]>([]);
	commentsRootPage = signal<number>(1);
	commentsRootLimit = signal<number>(10);
	repliesMaxDepth = signal<number>(4);
	
	newCommentContent = signal<string>('');
	activeReplyParentId = signal<string | null>(null);
	replyDrafts: WritableSignal<Record<string, string>> = signal({});
	editingCommentId = signal<string | null>(null);
	editingDraft = signal<string>('');
	showFilters = signal<boolean>(false);

	userProfile = this.userService.profileSignal;
	userEmail = this.userTokenService.emailSignal;
	admin = this.userTokenService.isAdminSignal;

	private commentParams = computed(() => ({
		chapterId: this.chapterId(),
		page: this.commentsRootPage(),
		limit: this.commentsRootLimit(),
		maxDepth: this.repliesMaxDepth(),
	}));

	constructor() {
		// Reactive loading of comments
		toObservable(this.commentParams)
			.pipe(
				filter((params) => !!params.chapterId),
				switchMap((params) => {
					this.commentsLoading.set(true);
					return this.chapterCommentsService.listChapterComments(
						params.chapterId,
						{
							page: params.page,
							limit: params.limit,
							maxDepth: params.maxDepth,
						},
					);
				}),
				takeUntilDestroyed(),
			)
			.subscribe({
				next: (response) => {
					this.commentsPage.set(response);
					this.flatComments.set(this.flattenComments(response.data));
					this.commentsLoading.set(false);
				},
				error: () => {
					this.commentsLoading.set(false);
					this.notificationService.error(
						'Erro ao carregar comentarios do capitulo.',
					);
				},
			});
	}

	ngOnInit(): void {}

	private checkAuthAndPrompt(): boolean {
		if (!this.userTokenService.hasValidAccessTokenSignal()) {
			this.modalNotificationService.show(
				'Ação não permitida',
				'Você precisa estar logado para realizar esta ação. Deseja fazer login?',
				[
					{ label: 'Cancelar', type: 'secondary' },
					{
						label: 'Fazer Login',
						type: 'primary',
						callback: () => this.router.navigate(['/auth/login']),
					},
				],
				'warning',
			);
			return false;
		}
		return true;
	}

	loadComments() {
		const params = this.commentParams();
		if (!params.chapterId) return;

		this.commentsLoading.set(true);
		this.chapterCommentsService
			.listChapterComments(params.chapterId, {
				page: params.page,
				limit: params.limit,
				maxDepth: params.maxDepth,
			})
			.subscribe({
				next: (response) => {
					this.commentsPage.set(response);
					this.flatComments.set(this.flattenComments(response.data));
					this.commentsLoading.set(false);
				},
				error: () => {
					this.commentsLoading.set(false);
					this.notificationService.error(
						'Erro ao carregar comentarios do capitulo.',
					);
				},
			});
	}

	submitComment() {
		if (!this.checkAuthAndPrompt()) return;

		const chapterId = this.chapterId();
		const content = this.newCommentContent().trim();
		if (!chapterId || !content) return;

		this.chapterCommentsService
			.createComment(chapterId, content)
			.subscribe({
				next: () => {
					this.newCommentContent.set('');
					this.commentsRootPage.set(1);
					this.loadComments();
				},
				error: () => {
					this.notificationService.error('Erro ao criar comentario.');
				},
			});
	}

	setReplyParent(commentId: string | null) {
		if (commentId !== null && !this.checkAuthAndPrompt()) return;
		this.activeReplyParentId.set(commentId);
	}

	updateReplyDraft(commentId: string, value: string) {
		this.replyDrafts.update((current) => ({
			...current,
			[commentId]: value,
		}));
	}

	submitReply(parentId: string) {
		if (!this.checkAuthAndPrompt()) return;

		const chapterId = this.chapterId();
		if (!chapterId) return;

		const draft = (this.replyDrafts()[parentId] || '').trim();
		if (!draft) return;

		this.chapterCommentsService
			.createReply(chapterId, parentId, draft)
			.subscribe({
				next: () => {
					this.updateReplyDraft(parentId, '');
					this.activeReplyParentId.set(null);
					this.loadComments();
				},
				error: () => {
					this.notificationService.error(
						'Erro ao responder comentario.',
					);
				},
			});
	}

	startEdit(comment: ChapterCommentNode) {
		if (!this.checkAuthAndPrompt()) return;
		this.editingCommentId.set(comment.id);
		this.editingDraft.set(comment.content);
	}

	cancelEdit() {
		this.editingCommentId.set(null);
		this.editingDraft.set('');
	}

	saveEdit(commentId: string) {
		if (!this.checkAuthAndPrompt()) return;

		const chapterId = this.chapterId();
		const content = this.editingDraft().trim();
		if (!chapterId || !content) return;

		this.chapterCommentsService
			.updateComment(chapterId, commentId, content)
			.subscribe({
				next: () => {
					this.cancelEdit();
					this.loadComments();
				},
				error: () => {
					this.notificationService.error(
						'Erro ao editar comentario.',
					);
				},
			});
	}

	deleteComment(commentId: string) {
		if (!this.checkAuthAndPrompt()) return;

		const chapterId = this.chapterId();
		if (!chapterId) return;

		this.chapterCommentsService
			.deleteComment(chapterId, commentId)
			.subscribe({
				next: () => {
					this.loadComments();
				},
				error: () => {
					this.notificationService.error(
						'Erro ao excluir comentario.',
					);
				},
			});
	}

	onNewCommentInput(event: Event) {
		const target = event.target as HTMLTextAreaElement | null;
		this.newCommentContent.set(target?.value || '');
	}

	onEditDraftInput(event: Event) {
		const target = event.target as HTMLTextAreaElement | null;
		this.editingDraft.set(target?.value || '');
	}

	onReplyDraftInput(commentId: string, event: Event) {
		const target = event.target as HTMLTextAreaElement | null;
		this.updateReplyDraft(commentId, target?.value || '');
	}

	private flattenComments(
		comments: ChapterCommentNode[],
	): FlattenedComment[] {
		const flattened: FlattenedComment[] = [];

		const walk = (nodes: ChapterCommentNode[], depth: number) => {
			for (const node of nodes) {
				flattened.push({ comment: node, depth });
				if (node.replies && node.replies.length > 0) {
					walk(node.replies, depth + 1);
				}
			}
		};

		walk(comments || [], 0);
		return flattened;
	}

	canEditComment(comment: ChapterCommentNode): boolean {
		const userId = this.userTokenService.userIdSignal();
		return this.admin() || userId === comment.userId;
	}

	getCommentInitials(userName: string): string {
		const normalized = (userName || '').trim();
		if (!normalized) return '?';

		const parts = normalized.split(/\s+/).filter(Boolean);
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
	}

	wasCommentEdited(comment: ChapterCommentNode): boolean {
		const created = new Date(comment.createdAt).getTime();
		const updated = new Date(comment.updatedAt).getTime();
		if (Number.isNaN(created) || Number.isNaN(updated)) return false;
		return updated - created > 1000;
	}

	openCommentAuthor(userId: string, event?: Event): void {
		event?.preventDefault();
		event?.stopPropagation();
		if (!userId) return;
		void this.router.navigate(['/users', userId]);
	}

	formatCommentContent(content: string): string {
		if (!content) return '';
		const normalizedSpoiler = content.replace(
			/\[spoiler\]([\s\S]+?)\[\/spoiler\]/gi,
			'||$1||',
		);
		return normalizedSpoiler.replace(
			/\|\|([\s\S]+?)\|\|/g,
			'<span class="comment-spoiler">$1</span>',
		);
	}

	applyBold(targetId: string) {
		this.wrapEditorSelection(targetId, '**', '**', 'texto em negrito');
	}

	applyItalic(targetId: string) {
		this.wrapEditorSelection(targetId, '*', '*', 'texto em italico');
	}

	applySpoiler(targetId: string) {
		this.wrapEditorSelection(targetId, '||', '||', 'spoiler');
	}

	insertLink(targetId: string) {
		const url = window.prompt('Cole a URL do link');
		if (!url?.trim()) return;
		const label =
			window.prompt('Texto do link (opcional)')?.trim() || 'link';
		this.insertIntoEditor(targetId, `[${label}](${url.trim()})`);
	}

	insertImage(targetId: string) {
		const url = window.prompt('Cole a URL da imagem');
		if (!url?.trim()) return;
		const alt =
			window.prompt('Descricao da imagem (opcional)')?.trim() || 'imagem';
		this.insertIntoEditor(targetId, `![${alt}](${url.trim()})`);
	}

	private wrapEditorSelection(
		targetId: string,
		prefix: string,
		suffix: string,
		placeholder: string,
	) {
		const textarea = this.getEditorElement(targetId);
		if (!textarea) {
			this.insertIntoEditor(targetId, `${prefix}${placeholder}${suffix}`);
			return;
		}

		const start = textarea.selectionStart ?? textarea.value.length;
		const end = textarea.selectionEnd ?? textarea.value.length;
		const selectedText = textarea.value.slice(start, end) || placeholder;
		const wrapped = `${prefix}${selectedText}${suffix}`;
		const nextValue =
			textarea.value.slice(0, start) +
			wrapped +
			textarea.value.slice(end);

		this.setEditorValue(targetId, nextValue);
		textarea.focus();
	}

	private insertIntoEditor(targetId: string, snippet: string) {
		const textarea = this.getEditorElement(targetId);
		if (!textarea) {
			const current = this.getEditorValue(targetId);
			const separator =
				current.endsWith('\n') || current.length === 0 ? '' : '\n';
			this.setEditorValue(targetId, `${current}${separator}${snippet}`);
			return;
		}

		const start = textarea.selectionStart ?? textarea.value.length;
		const end = textarea.selectionEnd ?? textarea.value.length;
		const nextValue =
			textarea.value.slice(0, start) +
			snippet +
			textarea.value.slice(end);
		this.setEditorValue(targetId, nextValue);
		textarea.focus();
	}

	private getEditorElement(targetId: string): HTMLTextAreaElement | null {
		return document.getElementById(targetId) as HTMLTextAreaElement | null;
	}

	private getEditorValue(targetId: string): string {
		if (targetId === 'new-comment-textarea') return this.newCommentContent();
		if (targetId === 'edit-comment-textarea') return this.editingDraft();
		if (targetId.startsWith('reply-comment-')) {
			const commentId = targetId.replace('reply-comment-', '');
			return this.replyDrafts()[commentId] || '';
		}
		return '';
	}

	private setEditorValue(targetId: string, value: string) {
		if (targetId === 'new-comment-textarea') {
			this.newCommentContent.set(value);
			return;
		}
		if (targetId === 'edit-comment-textarea') {
			this.editingDraft.set(value);
			return;
		}
		if (targetId.startsWith('reply-comment-')) {
			const commentId = targetId.replace('reply-comment-', '');
			this.updateReplyDraft(commentId, value);
		}
	}

	onRootLimitChange(event: Event) {
		const target = event.target as HTMLSelectElement | null;
		const parsed = Number(target?.value || 10);
		this.commentsRootLimit.set(parsed);
		this.commentsRootPage.set(1);
	}

	onRepliesDepthChange(event: Event) {
		const target = event.target as HTMLSelectElement | null;
		const parsed = Number(target?.value || 4);
		this.repliesMaxDepth.set(parsed);
	}

	goToPreviousCommentsPage() {
		if (this.commentsRootPage() <= 1) return;
		this.commentsRootPage.update((page) => page - 1);
	}

	goToNextCommentsPage() {
		const metadata = this.commentsPage()?.metadata;
		if (!metadata || this.commentsRootPage() >= metadata.lastPage) return;
		this.commentsRootPage.update((page) => page + 1);
	}
}
