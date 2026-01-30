import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TagsService } from './tags.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SensitiveContentService } from './sensitive-content.service';
import { UserTokenService } from './user-token.service';
import { DownloadService } from './download.service';
import { OfflineBook } from '../models/offline.models';

describe('TagsService', () => {
  let service: TagsService;
  let httpMock: HttpTestingController;
  let downloadServiceSpy: jasmine.SpyObj<DownloadService>;
  let sensitiveContentServiceSpy: jasmine.SpyObj<SensitiveContentService>;
  let userTokenServiceSpy: jasmine.SpyObj<UserTokenService>;

  const mockBlob = new Blob([''], { type: 'image/jpeg' });

  const mockOfflineBooks: OfflineBook[] = [
    {
      id: '1',
      title: 'Book A',
      cover: mockBlob,
      description: '',
      publication: 2023,
      authors: [],
      tags: [{ id: 't1', name: 'Action' }, { id: 't2', name: 'Comedy' }],
      sensitiveContent: [],
      totalChapters: 1,
      updatedAt: new Date()
    },
    {
      id: '2',
      title: 'Book B',
      cover: mockBlob,
      description: '',
      publication: 2023,
      authors: [],
      tags: [{ id: 't2', name: 'Comedy' }, { id: 't3', name: 'Drama' }],
      sensitiveContent: [{ id: 'sc1', name: 'Gore' }],
      totalChapters: 1,
      updatedAt: new Date()
    },
    {
        id: '3',
        title: 'Book C',
        cover: mockBlob,
        description: '',
        publication: 2023,
        authors: [],
        tags: undefined as any, // Missing tags
        sensitiveContent: [],
        totalChapters: 1,
        updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    const downloadSpy = jasmine.createSpyObj('DownloadService', ['getAllBooks']);
    const sensitiveSpy = jasmine.createSpyObj('SensitiveContentService', ['getContentAllow']);
    const userTokenSpy = jasmine.createSpyObj('UserTokenService', [], { hasValidAccessToken: false });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TagsService,
        { provide: DownloadService, useValue: downloadSpy },
        { provide: SensitiveContentService, useValue: sensitiveSpy },
        { provide: UserTokenService, useValue: userTokenSpy }
      ]
    });

    service = TestBed.inject(TagsService);
    httpMock = TestBed.inject(HttpTestingController);
    downloadServiceSpy = TestBed.inject(DownloadService) as jasmine.SpyObj<DownloadService>;
    sensitiveContentServiceSpy = TestBed.inject(SensitiveContentService) as jasmine.SpyObj<SensitiveContentService>;
    userTokenServiceSpy = TestBed.inject(UserTokenService) as jasmine.SpyObj<UserTokenService>;

    downloadServiceSpy.getAllBooks.and.returnValue(Promise.resolve(mockOfflineBooks));
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getTags', () => {
    it('should return tags from visible books only (Offline Fallback)', fakeAsync(() => {
        // Arrange: Block Gore, so Book B is hidden. Tags from Book B should not appear unless also in Book A.
        sensitiveContentServiceSpy.getContentAllow.and.returnValue([]); // Block all sensitive
        
        let resultTags: any[] = [];
        
        // Act
        service.getTags({}).subscribe(tags => {
            resultTags = tags;
        });

        const req = httpMock.expectOne(req => req.url.includes('tags'));
        req.flush('Error', { status: 500, statusText: 'Server Error' });
        
        tick(); // Resolve Promise from DownloadService

        // Assert
        // Book A is visible: tags t1(Action), t2(Comedy)
        // Book B is hidden (Gore): tags t2(Comedy), t3(Drama)
        // Book C is visible: tags undefined
        // Expected: Action, Comedy. Drama should be excluded.
        
        expect(resultTags.length).toBe(2);
        expect(resultTags.find(t => t.name === 'Action')).toBeTruthy();
        expect(resultTags.find(t => t.name === 'Comedy')).toBeTruthy();
        expect(resultTags.find(t => t.name === 'Drama')).toBeUndefined();
    }));

    it('should include tags from allowed sensitive books (Offline Fallback)', fakeAsync(() => {
        // Arrange: Allow Gore. Book B becomes visible.
        sensitiveContentServiceSpy.getContentAllow.and.returnValue(['Gore']);
        
        let resultTags: any[] = [];

        // Act
        service.getTags({}).subscribe(tags => {
            resultTags = tags;
        });

        const req = httpMock.expectOne(req => req.url.includes('tags'));
        req.flush('Error', { status: 500, statusText: 'Server Error' });

        tick();

        // Assert
        // All books visible.
        // Expected: Action, Comedy, Drama.
        
        expect(resultTags.length).toBe(3);
        expect(resultTags.find(t => t.name === 'Drama')).toBeTruthy();
    }));

    it('should handle undefined tags safely (Offline Fallback)', fakeAsync(() => {
        sensitiveContentServiceSpy.getContentAllow.and.returnValue([]);
        
        let resultTags: any[] = [];

        service.getTags({}).subscribe(tags => {
            resultTags = tags;
        });

        const req = httpMock.expectOne(req => req.url.includes('tags'));
        req.flush('Error', { status: 500, statusText: 'Server Error' });

        tick();

        expect(resultTags.length).toBe(2); // Should not crash on Book C
    }));
  });
});
