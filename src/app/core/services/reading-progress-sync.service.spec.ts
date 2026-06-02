import {
	HttpClientTestingModule,
	HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ENVIRONMENT } from '@core/tokens/environment.token';
import { WINDOW } from '@core/tokens/window.token';
import { SyncResponse } from '@models/reading-progress-events.model';
import { Subject } from 'rxjs';
import { BackgroundSyncRegistrationService } from './background-sync-registration.service';
import { MqttService } from './mqtt.service';
import { NetworkStatusService } from './network-status.service';
import { ReadingProgressService } from './reading-progress.service';
import { ReadingProgressSyncService } from './reading-progress-sync.service';
import { UserTokenService } from './user-token.service';

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
		});
		const localProgressSpy = jasmine.createSpyObj(
			'ReadingProgressService',
			['saveProgress', 'getProgress', 'enqueueSync', 'getCurrentUserId'],
		);
		const networkStatusSpy = jasmine.createSpyObj(
			'NetworkStatusService',
			[],
			{
				wentOffline$: new Subject<void>(),
				wentOnline$: new Subject<void>(),
			},
		);
		const backgroundSyncSpy = jasmine.createSpyObj(
			'BackgroundSyncRegistrationService',
			['register'],
		);
		backgroundSyncSpy.register.and.returnValue(Promise.resolve());

		const mqttSpy = jasmine.createSpyObj(
			'MqttService',
			['connect', 'disconnect', 'isConnected'],
			{
				progressSynced$: new Subject<SyncResponse>(),
			},
		);

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

	it('should save progress locally and register background sync', fakeAsync(() => {
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
		expect(localProgressServiceSpy.enqueueSync).toHaveBeenCalled();
		expect(backgroundSyncServiceSpy.register).toHaveBeenCalledWith(
			'sync-reading-progress',
		);

		const req = httpMock.expectOne('users/me/reading-progress');
		req.flush({ data: {} });
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

		const result = await service.getProgress('c1');
		expect(result).toEqual(mockLocalProgress);
	});
});
