import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReadingProgressSyncService, SyncStatus } from './reading-progress-sync.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserTokenService } from './user-token.service';
import { ReadingProgressService } from './reading-progress.service';
import { NetworkStatusService } from './network-status.service';
import { BackgroundSyncRegistrationService } from './background-sync-registration.service';
import { ENVIRONMENT } from '../tokens/environment.token';
import { WINDOW } from '../tokens/window.token';
import { WebSocketConnectionState } from '../models/websocket-state.model';
import { Subject, of } from 'rxjs';
import * as socketIo from 'socket.io-client';

describe('ReadingProgressSyncService', () => {
	let service: ReadingProgressSyncService;
	let httpMock: HttpTestingController;
	let userTokenServiceSpy: jasmine.SpyObj<UserTokenService>;
	let localProgressServiceSpy: jasmine.SpyObj<ReadingProgressService>;
	let networkStatusServiceSpy: jasmine.SpyObj<NetworkStatusService>;
	let backgroundSyncServiceSpy: jasmine.SpyObj<BackgroundSyncRegistrationService>;
	let mockSocket: any;

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
		mockSocket = {
			connected: false,
			on: jasmine.createSpy('on'),
			once: jasmine.createSpy('once'),
			off: jasmine.createSpy('off'),
			emit: jasmine.createSpy('emit'),
			disconnect: jasmine.createSpy('disconnect'),
			io: {
				on: jasmine.createSpy('io.on'),
				opts: { reconnection: true },
			},
		};

		const userTokenSpy = jasmine.createSpyObj('UserTokenService', [], {
			accessToken: 'mock-token',
			hasValidAccessToken: true,
		});
		const localProgressSpy = jasmine.createSpyObj('ReadingProgressService', [
			'saveProgress',
			'getProgress',
			'enqueueSync',
			'getCurrentUserId',
		]);
		const networkStatusSpy = jasmine.createSpyObj('NetworkStatusService', [], {
			wentOffline$: new Subject<void>(),
			wentOnline$: new Subject<void>(),
		});
		const backgroundSyncSpy = jasmine.createSpyObj(
			'BackgroundSyncRegistrationService',
			['register'],
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
				{ provide: ENVIRONMENT, useValue: mockEnv },
				{ provide: WINDOW, useValue: mockWindow },
			],
		});

		service = TestBed.inject(ReadingProgressSyncService);
		// @ts-ignore - spy on protected method
		spyOn<any>(service, 'createSocket').and.returnValue(mockSocket);

		httpMock = TestBed.inject(HttpTestingController);
		userTokenServiceSpy = TestBed.inject(
			UserTokenService,
		) as jasmine.SpyObj<UserTokenService>;
		localProgressServiceSpy = TestBed.inject(
			ReadingProgressService,
		) as jasmine.SpyObj<ReadingProgressService>;
		networkStatusServiceSpy = TestBed.inject(
			NetworkStatusService,
		) as jasmine.SpyObj<NetworkStatusService>;
		backgroundSyncServiceSpy = TestBed.inject(
			BackgroundSyncRegistrationService,
		) as jasmine.SpyObj<BackgroundSyncRegistrationService>;
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should initialize with DISCONNECTED state', () => {
		expect(service.connectionState()).toBe(
			WebSocketConnectionState.DISCONNECTED,
		);
	});

	it('should connect when connect() is called', () => {
		service.connect();
		expect((service as any).createSocket).toHaveBeenCalled();
		expect(service.connectionState()).toBe(
			WebSocketConnectionState.CONNECTING,
		);
	});

	it('should save progress locally and then via websocket if connected', fakeAsync(() => {
		mockSocket.connected = true;
		(service as any).socket = mockSocket;
		// Transição válida via CONNECTING
		service['transitionTo'](WebSocketConnectionState.CONNECTING);
		service['transitionTo'](WebSocketConnectionState.CONNECTED);

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
		expect(mockSocket.emit).toHaveBeenCalledWith(
			'progress:update',
			progressData,
		);
	}));

	it('should save progress locally and register background sync if disconnected', fakeAsync(() => {
		mockSocket.connected = false;
		(service as any).socket = null;
		service['transitionTo'](WebSocketConnectionState.DISCONNECTED);
		backgroundSyncServiceSpy.register.and.returnValue(Promise.resolve());
		localProgressServiceSpy.enqueueSync.and.returnValue(Promise.resolve());

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
		
		// Should also attempt HTTP sync
		const req = httpMock.expectOne('users/me/reading-progress');
		expect(req.request.method).toBe('POST');
		req.flush({ data: {} });
	}));

	it('should return local progress in getProgress if socket not connected', async () => {
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

	it('should update sync status correctly', () => {
		service['updateSyncStatus']({ syncing: true });
		expect(service.syncStatus().syncing).toBeTrue();

		service['updateSyncStatus']({ pendingChanges: 5 });
		expect(service.syncStatus().pendingChanges).toBe(5);
		expect(service.syncStatus().syncing).toBeTrue(); // Should preserve previous values
	});
});
