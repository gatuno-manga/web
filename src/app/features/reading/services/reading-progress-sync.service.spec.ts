import {
	HttpClientTestingModule,
	HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { UserTokenService } from '@core/services/auth/user-token.service';
import { BackgroundSyncRegistrationService } from '@core/services/realtime/background-sync-registration.service';
import { MqttService } from '@core/services/realtime/mqtt.service';
import { NetworkStatusService } from '@core/services/realtime/network-status.service';
import { ENVIRONMENT } from '@core/tokens/environment.token';
import { WINDOW } from '@core/tokens/window.token';
import { SyncResponse } from '@models/reading-progress-events.model';
import { BehaviorSubject, Subject } from 'rxjs';
import { ReadingProgressService } from './reading-progress.service';
import { ReadingProgressSyncService } from './reading-progress-sync.service';

describe('ReadingProgressSyncService', () => {
	let service: ReadingProgressSyncService;
	let httpMock: HttpTestingController;
	let _userTokenServiceSpy: jasmine.SpyObj<UserTokenService>;
	let localProgressServiceSpy: jasmine.SpyObj<ReadingProgressService>;
	let _networkStatusServiceSpy: jasmine.SpyObj<NetworkStatusService>;
	let backgroundSyncServiceSpy: jasmine.SpyObj<BackgroundSyncRegistrationService>;
	let mqttServiceSpy: jasmine.SpyObj<MqttService>;

	const mockEnv = {
		apiURL: 'http://localhost:3000',
		apiURLServer: 'http://localhost:3000',
	};

	const mockWindow = {
		location: {
			origin: 'http://localhost:4200',
		},
	};

	beforeEach(() => {
		const userTokenSpy = jasmine.createSpyObj('UserTokenService', [], {
			accessToken: 'mock-token',
			hasValidAccessToken: true,
			hasValidRefreshToken: false,
			userIdSignal: () => 'u1',
		});
		const localProgressSpy = jasmine.createSpyObj(
			'ReadingProgressService',
			[
				'saveProgress',
				'getProgress',
				'enqueueSync',
				'getCurrentUserId',
				'enqueuePendingReadMark',
				'getPendingReadMarks',
				'removePendingReadMarks',
			],
		);
		localProgressSpy.enqueuePendingReadMark.and.returnValue(
			Promise.resolve(),
		);
		localProgressSpy.getPendingReadMarks.and.returnValue(
			Promise.resolve([]),
		);
		localProgressSpy.removePendingReadMarks.and.returnValue(
			Promise.resolve(),
		);
		const networkStatusSpy = jasmine.createSpyObj(
			'NetworkStatusService',
			['isOffline'],
			{
				wentOffline$: new Subject<void>(),
				wentOnline$: new Subject<void>(),
			},
		);
		networkStatusSpy.isOffline.and.returnValue(false);
		const backgroundSyncSpy = jasmine.createSpyObj(
			'BackgroundSyncRegistrationService',
			['register'],
		);
		backgroundSyncSpy.register.and.returnValue(Promise.resolve());

		const connectedSubject = new BehaviorSubject<boolean>(false);
		const mqttSpy = jasmine.createSpyObj(
			'MqttService',
			['connect', 'disconnect', 'isConnected'],
			{
				progressSynced$: new Subject<SyncResponse>(),
				connected$: connectedSubject.asObservable(),
			},
		);
		mqttSpy.connect.and.callFake(() => connectedSubject.next(true));
		mqttSpy.disconnect.and.callFake(() => connectedSubject.next(false));

		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
			providers: [
				ReadingProgressSyncService,
				{ provide: UserTokenService, useValue: userTokenSpy },
				{ provide: ReadingProgressService, useValue: localProgressSpy },
				{ provide: NetworkStatusService, useValue: networkStatusSpy },
				{
					provide: BackgroundSyncRegistrationService,
					useValue: backgroundSyncSpy,
				},
				{ provide: MqttService, useValue: mqttSpy },
				{ provide: ENVIRONMENT, useValue: mockEnv },
				{ provide: WINDOW, useValue: mockWindow },
			],
		});

		service = TestBed.inject(ReadingProgressSyncService);
		httpMock = TestBed.inject(HttpTestingController);
		_userTokenServiceSpy = TestBed.inject(
			UserTokenService,
		) as jasmine.SpyObj<UserTokenService>;
		localProgressServiceSpy = TestBed.inject(
			ReadingProgressService,
		) as jasmine.SpyObj<ReadingProgressService>;
		_networkStatusServiceSpy = TestBed.inject(
			NetworkStatusService,
		) as jasmine.SpyObj<NetworkStatusService>;
		backgroundSyncServiceSpy = TestBed.inject(
			BackgroundSyncRegistrationService,
		) as jasmine.SpyObj<BackgroundSyncRegistrationService>;
		mqttServiceSpy = TestBed.inject(
			MqttService,
		) as jasmine.SpyObj<MqttService>;
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should initialize with DISCONNECTED state', () => {
		expect(service.syncStatus().connected).toBe(false);
	});

	it('should connect when connect() is called', () => {
		service.connect();
		expect(mqttServiceSpy.connect).toHaveBeenCalled();
		expect(service.syncStatus().connected).toBe(true);
	});

	it('should save progress locally and then via HTTP', fakeAsync(() => {
		const progressData = {
			chapterId: 'c1',
			bookId: 'b1',
			pageIndex: 5,
			timestamp: Date.now(),
		};

		service.saveProgress(progressData);
		tick();

		expect(localProgressServiceSpy.saveProgress).toHaveBeenCalledWith(
			'c1',
			'b1',
			5,
		);

		const req = httpMock.expectOne('users/me/reading-progress');
		expect(req.request.method).toBe('POST');
		req.flush({ data: progressData });
	}));

	it('should save progress locally and register background sync when HTTP fails', fakeAsync(() => {
		const progressData = {
			chapterId: 'c2',
			bookId: 'b1',
			pageIndex: 10,
			timestamp: Date.now(),
		};

		service.saveProgress(progressData);
		tick();

		expect(localProgressServiceSpy.saveProgress).toHaveBeenCalledWith(
			'c2',
			'b1',
			10,
		);

		const req = httpMock.expectOne('users/me/reading-progress');
		req.error(new ProgressEvent('Network error'));
		tick();

		expect(localProgressServiceSpy.enqueueSync).toHaveBeenCalled();
		expect(backgroundSyncServiceSpy.register).toHaveBeenCalledWith(
			'sync-reading-progress',
		);
	}));

	it('should return local progress in getProgress', async () => {
		const mockLocalProgress = {
			id: 'u1_c1',
			chapterId: 'c1',
			bookId: 'b1',
			userId: 'u1',
			pageIndex: 5,
			updatedAt: new Date(),
		};
		localProgressServiceSpy.getProgress.and.returnValue(
			Promise.resolve(mockLocalProgress),
		);

		const getProgressPromise = service.getProgress('c1');
		await Promise.resolve();
		const req = httpMock.expectOne('users/me/reading-progress/chapter/c1');
		req.flush({ data: null });

		const result = await getProgressPromise;
		expect(result).toEqual(mockLocalProgress);
	});

	describe('chapter read marking and offline flush', () => {
		it('should POST chapters/:id/read when online and authenticated', fakeAsync(() => {
			let resolved = false;
			service.markChapterRead('ch-1').then(() => {
				resolved = true;
			});

			const req = httpMock.expectOne('chapters/ch-1/read');
			expect(req.request.method).toBe('POST');
			req.flush({});
			tick();

			expect(resolved).toBeTrue();
			expect(
				localProgressServiceSpy.enqueuePendingReadMark,
			).not.toHaveBeenCalled();
		}));

		it('should enqueue read mark when offline without making HTTP call', async () => {
			_networkStatusServiceSpy.isOffline.and.returnValue(true);

			await service.markChapterRead('ch-offline');

			httpMock.expectNone('chapters/ch-offline/read');
			expect(
				localProgressServiceSpy.enqueuePendingReadMark,
			).toHaveBeenCalledWith('ch-offline');
		});

		it('should enqueue read mark on 5xx or status 0 errors', fakeAsync(() => {
			service.markChapterRead('ch-500');
			const req500 = httpMock.expectOne('chapters/ch-500/read');
			req500.flush('Server Error', {
				status: 503,
				statusText: 'Service Unavailable',
			});
			tick();
			expect(
				localProgressServiceSpy.enqueuePendingReadMark,
			).toHaveBeenCalledWith('ch-500');

			service.markChapterRead('ch-0');
			const req0 = httpMock.expectOne('chapters/ch-0/read');
			req0.error(new ProgressEvent('Network error'));
			tick();
			expect(
				localProgressServiceSpy.enqueuePendingReadMark,
			).toHaveBeenCalledWith('ch-0');
		}));

		it('should log and drop 4xx errors without enqueueing', fakeAsync(() => {
			spyOn(console, 'warn');
			service.markChapterRead('ch-404');
			const req = httpMock.expectOne('chapters/ch-404/read');
			req.flush('Not Found', { status: 404, statusText: 'Not Found' });
			tick();

			expect(
				localProgressServiceSpy.enqueuePendingReadMark,
			).not.toHaveBeenCalled();
		}));

		it('should enqueue retryable 4xx errors (401, 429) in markChapterRead', fakeAsync(() => {
			service.markChapterRead('ch-401');
			const req401 = httpMock.expectOne('chapters/ch-401/read');
			req401.flush('Unauthorized', {
				status: 401,
				statusText: 'Unauthorized',
			});
			tick();
			expect(
				localProgressServiceSpy.enqueuePendingReadMark,
			).toHaveBeenCalledWith('ch-401');

			service.markChapterRead('ch-429');
			const req429 = httpMock.expectOne('chapters/ch-429/read');
			req429.flush('Too Many Requests', {
				status: 429,
				statusText: 'Too Many Requests',
			});
			tick();
			expect(
				localProgressServiceSpy.enqueuePendingReadMark,
			).toHaveBeenCalledWith('ch-429');
		}));

		it('should flush pending read marks via batch endpoint and remove succeeded or not-found items', fakeAsync(() => {
			localProgressServiceSpy.getPendingReadMarks.and.returnValue(
				Promise.resolve([
					{
						id: 'u1_ch-ok',
						userId: 'u1',
						chapterId: 'ch-ok',
						createdAt: 1,
					},
					{
						id: 'u1_ch-missing',
						userId: 'u1',
						chapterId: 'ch-missing',
						createdAt: 2,
					},
					{
						id: 'u1_ch-retry',
						userId: 'u1',
						chapterId: 'ch-retry',
						createdAt: 3,
					},
				]),
			);

			service.flushPendingReadMarks();
			tick();

			const req = httpMock.expectOne('chapters/batch/read');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual([
				'ch-ok',
				'ch-missing',
				'ch-retry',
			]);
			req.flush([
				{ chapterId: 'ch-ok', success: true },
				{
					chapterId: 'ch-missing',
					success: false,
					error: 'Chapter Not Found',
				},
				{
					chapterId: 'ch-retry',
					success: false,
					error: 'Transient failure',
				},
			]);
			tick();

			expect(
				localProgressServiceSpy.removePendingReadMarks,
			).toHaveBeenCalledWith(['ch-ok', 'ch-missing'], 'u1');
		}));

		it('should flush pending read marks when wentOnline$ emits', fakeAsync(() => {
			localProgressServiceSpy.getPendingReadMarks.and.returnValue(
				Promise.resolve([
					{
						id: 'u1_ch-reconn',
						userId: 'u1',
						chapterId: 'ch-reconn',
						createdAt: 1,
					},
				]),
			);

			(_networkStatusServiceSpy.wentOnline$ as Subject<void>).next();
			tick();

			const req = httpMock.expectOne('chapters/batch/read');
			req.flush([{ chapterId: 'ch-reconn', success: true }]);
			tick();

			expect(
				localProgressServiceSpy.removePendingReadMarks,
			).toHaveBeenCalledWith(['ch-reconn'], 'u1');
		}));

		it('should flush pending read marks on reconnect even when access token expired offline if refresh token exists', fakeAsync(() => {
			Object.defineProperty(_userTokenServiceSpy, 'hasValidAccessToken', {
				get: () => false,
				configurable: true,
			});
			Object.defineProperty(
				_userTokenServiceSpy,
				'hasValidRefreshToken',
				{
					get: () => true,
					configurable: true,
				},
			);

			localProgressServiceSpy.getPendingReadMarks.and.returnValue(
				Promise.resolve([
					{
						id: 'u1_ch-expired',
						userId: 'u1',
						chapterId: 'ch-expired',
						createdAt: 1,
					},
				]),
			);

			(_networkStatusServiceSpy.wentOnline$ as Subject<void>).next();
			tick();

			expect(
				localProgressServiceSpy.getPendingReadMarks,
			).toHaveBeenCalledWith('u1');
			const req = httpMock.expectOne('chapters/batch/read');
			expect(req.request.body).toEqual(['ch-expired']);
			req.flush([{ chapterId: 'ch-expired', success: true }]);
			tick();

			expect(
				localProgressServiceSpy.removePendingReadMarks,
			).toHaveBeenCalledWith(['ch-expired'], 'u1');
		}));
	});
});
