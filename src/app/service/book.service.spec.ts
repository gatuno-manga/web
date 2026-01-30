import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BookService } from './book.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SensitiveContentService } from './sensitive-content.service';
import { UserTokenService } from './user-token.service';
import { BookWebsocketService } from './book-websocket.service';
import { DownloadService } from './download.service';
import { tag, SensitiveContentResponse, Author } from '../models/book.models';
import { OfflineBook } from '../models/offline.models';
import { of } from 'rxjs';

describe('BookService', () => {
  let service: BookService;
  let downloadServiceSpy: jasmine.SpyObj<DownloadService>;
  let sensitiveContentServiceSpy: jasmine.SpyObj<SensitiveContentService>;
  let userTokenServiceSpy: jasmine.SpyObj<UserTokenService>;
  let websocketServiceSpy: jasmine.SpyObj<BookWebsocketService>;

  const mockBlob = new Blob([''], { type: 'image/jpeg' });
  
  const mockOfflineBooks: OfflineBook[] = [
    {
      id: '1',
      title: 'Safe Book',
      cover: mockBlob,
      description: 'A safe book',
      publication: 2023,
      authors: [{ id: 'a1', name: 'Author 1' }],
      tags: [{ id: 't1', name: 'Adventure' }],
      sensitiveContent: [],
      totalChapters: 10,
      updatedAt: new Date()
    },
    {
      id: '2',
      title: 'Sensitive Book Gore',
      cover: mockBlob,
      description: 'Contains gore',
      publication: 2023,
      authors: [{ id: 'a2', name: 'Author 2' }],
      tags: [{ id: 't2', name: 'Horror' }],
      sensitiveContent: [{ id: 'sc1', name: 'Gore' }],
      totalChapters: 5,
      updatedAt: new Date()
    },
    {
      id: '3',
      title: 'Sensitive Book Nudity',
      cover: mockBlob,
      description: 'Contains nudity',
      publication: 2023,
      authors: [{ id: 'a3', name: 'Author 3' }],
      tags: [{ id: 't3', name: 'Romance' }],
      sensitiveContent: [{ id: 'sc2', name: 'Nudity' }],
      totalChapters: 8,
      updatedAt: new Date()
    },
    {
      id: '4',
      title: 'Mixed Sensitive Book',
      cover: mockBlob,
      description: 'Gore and Nudity',
      publication: 2023,
      authors: [],
      tags: [],
      sensitiveContent: [{ id: 'sc1', name: 'Gore' }, { id: 'sc2', name: 'Nudity' }],
      totalChapters: 12,
      updatedAt: new Date()
    },
    {
        id: '5',
        title: 'Undefined Tags Book',
        cover: mockBlob,
        description: 'No tags info',
        publication: 2024,
        authors: [],
        tags: undefined as any, // Simulate missing data
        sensitiveContent: [],
        totalChapters: 2,
        updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    const downloadSpy = jasmine.createSpyObj('DownloadService', ['getAllBooks']);
    const sensitiveSpy = jasmine.createSpyObj('SensitiveContentService', ['getContentAllow']);
    const userTokenSpy = jasmine.createSpyObj('UserTokenService', [], { hasValidAccessToken: false, hasValidRefreshToken: false });
    const websocketSpy = jasmine.createSpyObj('BookWebsocketService', ['connect', 'disconnect']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        BookService,
        { provide: DownloadService, useValue: downloadSpy },
        { provide: SensitiveContentService, useValue: sensitiveSpy },
        { provide: UserTokenService, useValue: userTokenSpy },
        { provide: BookWebsocketService, useValue: websocketSpy }
      ]
    });

    service = TestBed.inject(BookService);
    downloadServiceSpy = TestBed.inject(DownloadService) as jasmine.SpyObj<DownloadService>;
    sensitiveContentServiceSpy = TestBed.inject(SensitiveContentService) as jasmine.SpyObj<SensitiveContentService>;
    userTokenServiceSpy = TestBed.inject(UserTokenService) as jasmine.SpyObj<UserTokenService>;
    websocketServiceSpy = TestBed.inject(BookWebsocketService) as jasmine.SpyObj<BookWebsocketService>;

    // Default mock behavior
    downloadServiceSpy.getAllBooks.and.returnValue(Promise.resolve(mockOfflineBooks));
    sensitiveContentServiceSpy.getContentAllow.and.returnValue([]); // Default: allow nothing
    
    // Mock URL.createObjectURL
    spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
    spyOn(URL, 'revokeObjectURL');
  });

  describe('getOfflineBooks', () => {
    
    it('should return all safe books when no sensitive content is allowed', (done) => {
      sensitiveContentServiceSpy.getContentAllow.and.returnValue([]);

      service.getOfflineBooks({}).subscribe(page => {
        expect(page.data.length).toBe(2); // Safe Book + Undefined Tags Book
        expect(page.data.find(b => b.id === '1')).toBeTruthy();
        expect(page.data.find(b => b.id === '5')).toBeTruthy();
        expect(page.data.find(b => b.id === '2')).toBeUndefined(); // Gore
        done();
      });
    });

    it('should return safe books + allowed sensitive content (by Name)', (done) => {
      sensitiveContentServiceSpy.getContentAllow.and.returnValue(['Gore']);

      service.getOfflineBooks({}).subscribe(page => {
        expect(page.data.length).toBe(3); // Safe(1) + Gore(2) + Undefined(5)
        expect(page.data.find(b => b.id === '2')).toBeTruthy(); // Gore allowed
        expect(page.data.find(b => b.id === '3')).toBeUndefined(); // Nudity not allowed
        expect(page.data.find(b => b.id === '4')).toBeUndefined(); // Mixed (Gore ok, Nudity block)
        done();
      });
    });

    it('should return safe books + allowed sensitive content (by ID)', (done) => {
        // Simulating preference stored as IDs
        sensitiveContentServiceSpy.getContentAllow.and.returnValue(['sc2']); // Nudity ID
  
        service.getOfflineBooks({}).subscribe(page => {
          expect(page.data.length).toBe(3); // Safe(1) + Nudity(3) + Undefined(5)
          expect(page.data.find(b => b.id === '3')).toBeTruthy();
          expect(page.data.find(b => b.id === '2')).toBeUndefined();
          done();
        });
    });

    it('should handle books with multiple sensitive contents correctly', (done) => {
        // Need both 'Gore' and 'Nudity' to see book 4
        sensitiveContentServiceSpy.getContentAllow.and.returnValue(['Gore', 'Nudity']);
  
        service.getOfflineBooks({}).subscribe(page => {
          expect(page.data.length).toBe(5); // All books visible
          expect(page.data.find(b => b.id === '4')).toBeTruthy();
          done();
        });
    });

    it('should filter by search term (case insensitive)', (done) => {
        service.getOfflineBooks({ search: 'gore' }).subscribe(page => {
            // Should find 'Sensitive Book Gore'(2) and 'Mixed Sensitive Book'(4)
            // But first, apply sensitive filter. Let's allow all for this test to focus on search
            sensitiveContentServiceSpy.getContentAllow.and.returnValue(['Gore', 'Nudity']);
        });

        // Let's reset and allow Gore
        sensitiveContentServiceSpy.getContentAllow.and.returnValue(['Gore', 'Nudity']);

        service.getOfflineBooks({ search: 'safe' }).subscribe(page => {
            expect(page.data.length).toBe(1);
            expect(page.data[0].id).toBe('1');
            done();
        });
    });

    it('should filter by tags', (done) => {
        sensitiveContentServiceSpy.getContentAllow.and.returnValue([]);

        service.getOfflineBooks({ tags: ['Adventure'] }).subscribe(page => {
            expect(page.data.length).toBe(1);
            expect(page.data[0].id).toBe('1');
            done();
        });
    });

    it('should handle undefined tags safely', (done) => {
        sensitiveContentServiceSpy.getContentAllow.and.returnValue([]);
        
        // Searching for a tag that doesn't exist, should safely check book 5 (undefined tags) without crashing
        service.getOfflineBooks({ tags: ['NonExistent'] }).subscribe(page => {
            expect(page.data.length).toBe(0);
            done();
        });
    });

    it('should map cover Blobs to object URLs', (done) => {
        sensitiveContentServiceSpy.getContentAllow.and.returnValue([]);

        service.getOfflineBooks({}).subscribe(page => {
            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(page.data[0].cover).toBe('blob:url');
            done();
        });
    });
  });
});
