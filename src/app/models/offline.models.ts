import { tag, SensitiveContentResponse, Author, ContentType, ContentFormat, DocumentFormat } from './book.models';

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
  downloadedAt: Date;
  next?: string;
  previous?: string;
  // Multi-format support
  contentType: ContentType;
  pages: Blob[];                    // IMAGE: array of image blobs
  content?: string;                 // TEXT: markdown/html content
  contentFormat?: ContentFormat;    // TEXT: format type
  document?: Blob;                  // DOCUMENT: single PDF/EPUB blob
  documentFormat?: DocumentFormat;  // DOCUMENT: format type
}

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'error';

export interface DownloadProgress {
  chapterId: string;
  total: number;
  current: number;
  status: DownloadStatus;
}
