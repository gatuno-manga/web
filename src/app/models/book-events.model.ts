export interface BookEvent {
	id: string;
	title: string;
	type?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface ChapterEvent {
	bookId: string;
	chapters?: Array<{
		id: string;
		title: string;
		index: number;
		scrapingStatus: string;
	}>;
	chapter?: {
		id: string;
		title: string;
		index: number;
		scrapingStatus: string;
	};
	chapterIds?: string[];
}

export interface CoverEvent {
	bookId: string;
	coverId: string;
	url?: string;
}

export interface ScrapingEvent {
	chapterId: string;
	bookId: string;
	pagesCount?: number;
	error?: string;
}

export interface NewChaptersEvent {
	bookId: string;
	newChaptersCount: number;
	chapters: Array<{
		id: string;
		title: string;
		index: number;
	}>;
}

export interface UpdateStartedEvent {
	bookId: string;
	bookTitle: string;
	jobId: string;
	timestamp: number;
}

export interface UpdateCompletedEvent {
	bookId: string;
	bookTitle: string;
	jobId: string;
	newChapters: number;
	newCovers: number;
	timestamp: number;
}

export interface UpdateFailedEvent {
	bookId: string;
	bookTitle: string;
	jobId: string;
	error: string;
	timestamp: number;
}

export interface SubscriptionResponse {
	type: 'book' | 'chapter';
	id: string;
	success: boolean;
	error?: string;
}

export interface SubscriptionsListResponse {
	books: string[];
	chapters: string[];
	isAdmin: boolean;
}

/**
 * Mapeamento de tipos para eventos do servidor → cliente.
 *
 * Define a assinatura de cada evento que o servidor pode emitir,
 * garantindo type-safety ao registrar listeners no Socket.io.
 *
 * **Uso:**
 * ```typescript
 * const socket: Socket<ServerToClientEvents, ClientToServerEvents>;
 *
 * // TypeScript sabe que callback recebe BookEvent
 * socket.on(BookEvents.CREATED, (event) => {
 *   console.log(event.title); // Type-safe!
 * });
 * ```
 */
export interface ServerToClientEvents {
	// Book Events
	'book.created': (event: BookEvent) => void;
	'book.updated': (event: BookEvent) => void;
	'book.deleted': (event: BookEvent) => void;
	'book.new-chapters': (event: NewChaptersEvent) => void;
	'book.update.started': (event: UpdateStartedEvent) => void;
	'book.update.completed': (event: UpdateCompletedEvent) => void;
	'book.update.failed': (event: UpdateFailedEvent) => void;

	// Chapter Events
	'chapter.created': (event: ChapterEvent) => void;
	'chapters.updated': (event: ChapterEvent) => void;
	'chapter.updated': (event: ChapterEvent) => void;
	'chapters.fix': (event: ChapterEvent) => void;
	'chapter.deleted': (event: ChapterEvent) => void;
	'chapter.pages.uploaded': (event: ChapterEvent) => void;

	// Scraping Events
	'chapter.scraping.started': (event: ScrapingEvent) => void;
	'chapter.scraping.completed': (event: ScrapingEvent) => void;
	'chapter.scraping.failed': (event: ScrapingEvent) => void;

	// Cover Events
	'cover.processed': (event: CoverEvent) => void;
	'cover.selected': (event: CoverEvent) => void;
	'cover.updated': (event: CoverEvent) => void;
	'cover.uploaded': (event: CoverEvent) => void;
	'covers.uploaded': (event: { bookId: string; coverIds: string[] }) => void;
	'cover.deleted': (event: CoverEvent) => void;
	'covers.reordered': (event: { bookId: string; coverIds: string[] }) => void;

	// Page Events
	'page.deleted': (event: { chapterId: string; pageId: string }) => void;

	// Subscription Events
	subscribed: (data: SubscriptionResponse) => void;
	unsubscribed: (data: SubscriptionResponse) => void;
	subscriptions: (data: SubscriptionsListResponse) => void;

	// Generic error
	error: (error: unknown) => void;
}

/**
 * Mapeamento de tipos para eventos do cliente → servidor.
 *
 * Define a assinatura de cada comando que o cliente pode enviar,
 * garantindo type-safety ao emitir eventos.
 *
 * **Uso:**
 * ```typescript
 * const socket: Socket<ServerToClientEvents, ClientToServerEvents>;
 *
 * // TypeScript valida que bookId é string
 * socket.emit('subscribe:book', bookId);
 *
 * // Erro: argumento incorreto
 * socket.emit('subscribe:book', 123); // ❌ Type error
 * ```
 */
export interface ClientToServerEvents {
	// Subscription Management
	'subscribe:book': (bookId: string) => void;
	'subscribe:chapter': (chapterId: string) => void;
	'unsubscribe:book': (bookId: string) => void;
	'unsubscribe:chapter': (chapterId: string) => void;
	'list:subscriptions': () => void;
}
