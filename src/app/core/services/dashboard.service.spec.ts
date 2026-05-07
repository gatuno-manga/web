import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DashboardService } from './dashboard.service';
import { DashboardOverview, DashboardProgress, QueueStats } from '@models/dashboard.models';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DashboardService]
    });
    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getOverview should call dashboard/overview and set headers', () => {
    const mockOverview: DashboardOverview = { totalBooks: 10 } as any;

    service.getOverview().subscribe(overview => {
      expect(overview).toEqual(mockOverview);
    });

    const req = httpMock.expectOne('dashboard/overview');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
    req.flush(mockOverview);
  });

  it('getProgressBooks should call books/dashboard/process-book', () => {
    const mockProgress: DashboardProgress = [] as any;

    service.getProgressBooks().subscribe(progress => {
      expect(progress).toEqual(mockProgress);
    });

    const req = httpMock.expectOne('books/dashboard/process-book');
    expect(req.request.method).toBe('GET');
    req.flush(mockProgress);
  });

  it('getQueueStats should call books/dashboard/queue-stats', () => {
    const mockStats: QueueStats = { waiting: 1 } as any;

    service.getQueueStats().subscribe(stats => {
      expect(stats).toEqual(mockStats);
    });

    const req = httpMock.expectOne('books/dashboard/queue-stats');
    expect(req.request.method).toBe('GET');
    req.flush(mockStats);
  });

  it('forceUpdateAll should call books/check-all-updates', () => {
    service.forceUpdateAll().subscribe();

    const req = httpMock.expectOne('books/check-all-updates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});
