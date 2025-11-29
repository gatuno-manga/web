import { tag, SensitiveContentResponse, Author } from './book.models';

export interface OfflineBook {
  id: string;
  title: string;
  cover: Blob;
  description: string;
  publication: number;
  authors: Author[];
  tags: tag[];
  sensitiveContent: SensitiveContentResponse[];
  totalChapters: number;
  updatedAt: Date;
}

export interface OfflineChapter {
  id: string;
  bookId: string;
  title: string;
  index: number;
  pages: Blob[];
  downloadedAt: Date;
  next?: string;
  previous?: string;
}

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'error';

export interface DownloadProgress {
  chapterId: string;
  total: number;
  current: number;
  status: DownloadStatus;
}
