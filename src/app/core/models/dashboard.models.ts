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

// ── Queue Stats ─────────────────────────────────────────────

export interface QueueCounts {
	waiting: number;
	active: number;
	completed: number;
	failed: number;
	delayed: number;
}

export interface QueueJobInfo {
	id: string;
	bookId?: string | null;
	bookTitle: string;
	chapterId?: string | null;
	chapterTitle?: string | null;
	urlOrigin?: string | null;
	timestamp?: number;
	delayed?: boolean;
	processAt?: string | null;
}

export interface QueueInfo {
	name: string;
	counts: QueueCounts;
	activeJobs: QueueJobInfo[];
	pendingJobs: QueueJobInfo[];
}

export interface QueueStats {
	queues: QueueInfo[];
}

export interface RecentQueueEvent extends QueueJobInfo {
	status: 'active' | 'completed' | 'failed';
}
