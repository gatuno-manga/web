import {
	HttpClientTestingModule,
	HttpTestingController,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WebSocketConnectionState } from '@core/models/websocket-state.model';
import { UserTokenService } from '@core/services/auth/user-token.service';
import { NotificationService } from '@core/services/notification/notification.service';
import { ENVIRONMENT } from '@core/tokens/environment.token';
import { NOTIFICATIONS_ENABLED } from '@core/tokens/notifications-enabled.token';
import { WINDOW } from '@core/tokens/window.token';
import type { MqttClient } from 'mqtt';
import { Subject } from 'rxjs';
import { MqttService } from './mqtt.service';
import { NetworkStatusService } from './network-status.service';

describe('MqttService', () => {
	let service: MqttService;
	let _httpMock: HttpTestingController;
	let userTokenServiceSpy: jasmine.SpyObj<UserTokenService>;
	let networkStatusServiceSpy: jasmine.SpyObj<NetworkStatusService>;
	let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
	let notificationsEnabledSignal = signal(true);

	let mockEnv: {
		production?: boolean;
		apiURL: string;
		apiURLServer: string;
		mqttBrokerUrl?: string;
	};

	let mockWindow: {
		location: {
			protocol: string;
			host: string;
			hostname: string;
			origin: string;
		};
	};

	const offline$ = new Subject<void>();
	const online$ = new Subject<void>();

	beforeEach(() => {
		mockEnv = {
			production: false,
			apiURL: 'http://localhost:3000/api',
			apiURLServer: 'http://localhost:3000/api',
			mqttBrokerUrl: undefined,
		};

		mockWindow = {
			location: {
				protocol: 'http:',
				host: 'localhost:4200',
				hostname: 'localhost',
				origin: 'http://localhost:4200',
			},
		};

		userTokenServiceSpy = jasmine.createSpyObj(
			'UserTokenService',
			['userIdSignal'],
			{
				accessToken: 'mock-jwt-token',
				hasValidAccessToken: true,
			},
		);
		userTokenServiceSpy.userIdSignal.and.returnValue('user-123');

		networkStatusServiceSpy = jasmine.createSpyObj(
			'NetworkStatusService',
			[],
			{
				wentOffline$: offline$.asObservable(),
				wentOnline$: online$.asObservable(),
				isOnline: true,
			},
		);

		notificationServiceSpy = jasmine.createSpyObj('NotificationService', [
			'show',
			'success',
			'error',
			'info',
			'warning',
		]);

		notificationsEnabledSignal = signal(true);

		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
			providers: [
				MqttService,
				{ provide: UserTokenService, useValue: userTokenServiceSpy },
				{
					provide: NetworkStatusService,
					useValue: networkStatusServiceSpy,
				},
				{
					provide: NotificationService,
					useValue: notificationServiceSpy,
				},
				{
					provide: NOTIFICATIONS_ENABLED,
					useValue: notificationsEnabledSignal,
				},
				{ provide: ENVIRONMENT, useValue: mockEnv },
				{ provide: WINDOW, useValue: mockWindow },
			],
		});

		_httpMock = TestBed.inject(HttpTestingController);
		service = TestBed.inject(MqttService);
	});

	afterEach(() => {
		service.disconnect();
	});

	describe('Broker URL and Protocol Resolution (getBrokerConfig)', () => {
		it('should return ws URL and ws protocol on HTTP without env var', () => {
			mockWindow.location.protocol = 'http:';
			mockWindow.location.hostname = 'localhost';
			mockEnv.mqttBrokerUrl = undefined;

			const config = service.getBrokerConfig();
			expect(config.brokerUrl).toBe('ws://localhost:8083/mqtt');
			expect(config.protocol).toBe('ws');
		});

		it('should return wss URL and wss protocol on HTTPS without env var', () => {
			mockWindow.location.protocol = 'https:';
			mockWindow.location.host = 'gatuno.canto.internal';
			mockEnv.mqttBrokerUrl = undefined;

			const config = service.getBrokerConfig();
			expect(config.brokerUrl).toBe('wss://gatuno.canto.internal/mqtt');
			expect(config.protocol).toBe('wss');
		});

		it('should preserve wss URL when configured in env', () => {
			mockWindow.location.protocol = 'https:';
			mockEnv.mqttBrokerUrl = 'wss://gatuno.canto.internal/mqtt/';

			const config = service.getBrokerConfig();
			expect(config.brokerUrl).toBe('wss://gatuno.canto.internal/mqtt/');
			expect(config.protocol).toBe('wss');
		});

		it('should automatically upgrade ws to wss when page is loaded over HTTPS', () => {
			mockWindow.location.protocol = 'https:';
			mockEnv.mqttBrokerUrl = 'ws://gatuno.canto.internal/mqtt/';

			const config = service.getBrokerConfig();
			expect(config.brokerUrl).toBe('wss://gatuno.canto.internal/mqtt/');
			expect(config.protocol).toBe('wss');
		});

		it('should keep ws URL when page is loaded over HTTP', () => {
			mockWindow.location.protocol = 'http:';
			mockEnv.mqttBrokerUrl = 'ws://localhost:8083/mqtt';

			const config = service.getBrokerConfig();
			expect(config.brokerUrl).toBe('ws://localhost:8083/mqtt');
			expect(config.protocol).toBe('ws');
		});
	});

	describe('Connection Lifecycle', () => {
		let fakeClient: jasmine.SpyObj<MqttClient>;

		beforeEach(() => {
			fakeClient = jasmine.createSpyObj('MqttClient', [
				'on',
				'end',
				'subscribe',
				'unsubscribe',
				'publish',
			]);
			fakeClient.on.and.returnValue(fakeClient);
			fakeClient.subscribe.and.returnValue(fakeClient);
			fakeClient.unsubscribe.and.returnValue(fakeClient);
		});

		it('should connect using resolved broker config and credentials', () => {
			mockWindow.location.protocol = 'https:';
			mockEnv.mqttBrokerUrl = 'wss://gatuno.canto.internal/mqtt/';

			const mqttConnectSpy = spyOn<any>(
				service,
				'createMqttClient',
			).and.returnValue(fakeClient);

			service.connect();

			expect(mqttConnectSpy).toHaveBeenCalledWith(
				'wss://gatuno.canto.internal/mqtt/',
				jasmine.objectContaining({
					protocol: 'wss',
					username: 'user-123',
					password: 'mock-jwt-token',
				}),
			);
			expect(service.connectionState()).toBe(
				WebSocketConnectionState.CONNECTING,
			);
		});

		it('should not connect if token is missing', () => {
			Object.defineProperty(userTokenServiceSpy, 'accessToken', {
				get: () => null,
			});
			const mqttConnectSpy = spyOn<any>(service, 'createMqttClient');

			service.connect();

			expect(mqttConnectSpy).not.toHaveBeenCalled();
			expect(service.connectionState()).toBe(
				WebSocketConnectionState.DISCONNECTED,
			);
		});

		it('should disconnect cleanly and reset state', () => {
			spyOn<any>(service, 'createMqttClient').and.returnValue(fakeClient);
			service.connect();

			service.disconnect();

			expect(fakeClient.end).toHaveBeenCalled();
			expect(service.connectionState()).toBe(
				WebSocketConnectionState.DISCONNECTED,
			);
			expect(service.connected()).toBeFalse();
		});
	});

	describe('Dynamic Topics & Reconnect Ref-Counting', () => {
		function createMockMqttClient(): {
			client: jasmine.SpyObj<MqttClient>;
			emit: (event: string, ...args: unknown[]) => void;
		} {
			const handlers = new Map<
				string,
				Array<(...args: unknown[]) => void>
			>();
			const client = jasmine.createSpyObj<MqttClient>('MqttClient', [
				'on',
				'end',
				'subscribe',
				'unsubscribe',
				'publish',
			]);
			client.on.and.callFake(((
				event: string,
				cb: (...args: unknown[]) => void,
			) => {
				const list = handlers.get(event) ?? [];
				list.push(cb);
				handlers.set(event, list);
				return client;
			}) as MqttClient['on']);
			client.subscribe.and.returnValue(client);
			client.unsubscribe.and.returnValue(client);

			return {
				client,
				emit: (event: string, ...args: unknown[]) => {
					for (const cb of handlers.get(event) ?? []) {
						cb(...args);
					}
				},
			};
		}

		it('should not inflate subscribedTopics ref-counts when connect fires multiple times', () => {
			const mock = createMockMqttClient();
			spyOn<any>(service, 'createMqttClient').and.returnValue(
				mock.client,
			);

			service.connect();
			mock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications', 'books/global'] },
			});

			expect(mock.client.subscribe.calls.count()).toBe(2);
			expect(
				(service as any).subscribedTopics.get('user/123/notifications'),
			).toBe(1);
			expect((service as any).subscribedTopics.get('books/global')).toBe(
				1,
			);

			// Broker reconnect emits 'connect' again on the same client
			mock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: {
					topics: [
						'user/123/notifications',
						'books/global',
						'books/new-global',
					],
				},
			});

			// resubscribeAll() subscribes the 2 existing topics + 1 newly added dynamic topic = 3 new calls (5 total)
			expect(mock.client.subscribe.calls.count()).toBe(5);
			expect(
				(service as any).subscribedTopics.get('user/123/notifications'),
			).toBe(1);
			expect((service as any).subscribedTopics.get('books/global')).toBe(
				1,
			);
			expect(
				(service as any).subscribedTopics.get('books/new-global'),
			).toBe(1);
		});

		it('should preserve dynamicTopics without inflating ref-counts across offline/online reconnect', () => {
			const firstMock = createMockMqttClient();
			const secondMock = createMockMqttClient();
			const createSpy = spyOn<any>(
				service,
				'createMqttClient',
			).and.returnValues(firstMock.client, secondMock.client);

			service.connect();
			firstMock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications'] },
			});

			offline$.next();
			expect(service.connectionState()).toBe(
				WebSocketConnectionState.OFFLINE_PAUSED,
			);

			online$.next();
			expect(createSpy).toHaveBeenCalledTimes(2);
			secondMock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications'] },
			});

			// Only resubscribeAll() should subscribe on the new client, not a duplicate subscribeTopic()
			expect(secondMock.client.subscribe.calls.count()).toBe(1);
			expect(
				(service as any).subscribedTopics.get('user/123/notifications'),
			).toBe(1);
		});

		it('should clear dynamicTopics on manual disconnect so a fresh connect re-subscribes', () => {
			const firstMock = createMockMqttClient();
			const secondMock = createMockMqttClient();
			spyOn<any>(service, 'createMqttClient').and.returnValues(
				firstMock.client,
				secondMock.client,
			);

			service.connect();
			firstMock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications'] },
			});

			service.disconnect();
			expect((service as any).subscribedTopics.size).toBe(0);

			service.connect();
			secondMock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications'] },
			});

			expect(secondMock.client.subscribe).toHaveBeenCalledWith(
				'user/123/notifications',
				{ qos: 1 },
				jasmine.any(Function),
			);
			expect(
				(service as any).subscribedTopics.get('user/123/notifications'),
			).toBe(1);
		});

		it('should ignore stale /interactions/mqtt-topics response if disconnected before it settles', () => {
			const firstMock = createMockMqttClient();
			const secondMock = createMockMqttClient();
			spyOn<any>(service, 'createMqttClient').and.returnValues(
				firstMock.client,
				secondMock.client,
			);

			service.connect();
			firstMock.emit('connect');
			const staleReq = _httpMock.expectOne('/interactions/mqtt-topics');

			// Disconnect before the in-flight HTTP response arrives, then start a new connection
			service.disconnect();
			service.connect();

			staleReq.flush({
				data: { topics: ['user/123/notifications'] },
			});

			expect((service as any).subscribedTopics.size).toBe(0);
			expect((service as any).dynamicTopics.size).toBe(0);

			secondMock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications'] },
			});

			expect(secondMock.client.subscribe).toHaveBeenCalledWith(
				'user/123/notifications',
				{ qos: 1 },
				jasmine.any(Function),
			);
			expect(
				(service as any).subscribedTopics.get('user/123/notifications'),
			).toBe(1);
		});

		it('should clear dynamicTopics and subscribedTopics when disconnect is called while OFFLINE_PAUSED', () => {
			const firstMock = createMockMqttClient();
			const secondMock = createMockMqttClient();
			spyOn<any>(service, 'createMqttClient').and.returnValues(
				firstMock.client,
				secondMock.client,
			);

			service.connect();
			firstMock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications'] },
			});

			offline$.next();
			expect(service.connectionState()).toBe(
				WebSocketConnectionState.OFFLINE_PAUSED,
			);

			service.disconnect();
			expect(service.connectionState()).toBe(
				WebSocketConnectionState.DISCONNECTED,
			);
			expect((service as any).subscribedTopics.size).toBe(0);
			expect((service as any).dynamicTopics.size).toBe(0);

			service.connect();
			secondMock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications'] },
			});

			expect(secondMock.client.subscribe).toHaveBeenCalledWith(
				'user/123/notifications',
				{ qos: 1 },
				jasmine.any(Function),
			);
			expect(
				(service as any).subscribedTopics.get('user/123/notifications'),
			).toBe(1);
		});

		it('should allow subsequent reconnect to subscribe if /interactions/mqtt-topics fails with HTTP error', () => {
			const mock = createMockMqttClient();
			spyOn<any>(service, 'createMqttClient').and.returnValue(
				mock.client,
			);

			service.connect();
			mock.emit('connect');
			_httpMock
				.expectOne('/interactions/mqtt-topics')
				.flush('Server Error', {
					status: 500,
					statusText: 'Internal Server Error',
				});

			expect((service as any).dynamicTopics.size).toBe(0);
			expect((service as any).subscribedTopics.size).toBe(0);

			mock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: ['user/123/notifications'] },
			});

			expect(mock.client.subscribe).toHaveBeenCalledWith(
				'user/123/notifications',
				{ qos: 1 },
				jasmine.any(Function),
			);
			expect(
				(service as any).subscribedTopics.get('user/123/notifications'),
			).toBe(1);
		});

		it('should unsubscribe both chapterTopic and bookTopic on watchChapter teardown when no other watcher is active', () => {
			const mock = createMockMqttClient();
			spyOn<any>(service, 'createMqttClient').and.returnValue(
				mock.client,
			);

			service.connect();
			mock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: [] },
			});

			const sub = service.watchChapter('ch-1', 'book-1').subscribe();
			expect(mock.client.subscribe).toHaveBeenCalledWith(
				'books/events/chapter/ch-1',
				{ qos: 1 },
				jasmine.any(Function),
			);
			expect(mock.client.subscribe).toHaveBeenCalledWith(
				'books/events/book/book-1',
				{ qos: 1 },
				jasmine.any(Function),
			);

			sub.unsubscribe();

			expect(mock.client.unsubscribe).toHaveBeenCalledWith(
				'books/events/chapter/ch-1',
			);
			expect(mock.client.unsubscribe).toHaveBeenCalledWith(
				'books/events/book/book-1',
			);
			expect(
				(service as any).subscribedTopics.has(
					'books/events/chapter/ch-1',
				),
			).toBeFalse();
			expect(
				(service as any).subscribedTopics.has(
					'books/events/book/book-1',
				),
			).toBeFalse();
		});

		it('should keep bookTopic subscribed while concurrent watchBook is active and unsubscribe when both tear down', () => {
			const mock = createMockMqttClient();
			spyOn<any>(service, 'createMqttClient').and.returnValue(
				mock.client,
			);

			service.connect();
			mock.emit('connect');
			_httpMock.expectOne('/interactions/mqtt-topics').flush({
				data: { topics: [] },
			});

			const bookSub = service.watchBook('book-1').subscribe();
			const chapterSub = service
				.watchChapter('ch-1', 'book-1')
				.subscribe();

			expect(
				(service as any).subscribedTopics.get(
					'books/events/book/book-1',
				),
			).toBe(2);
			expect(
				(service as any).subscribedTopics.get(
					'books/events/chapter/ch-1',
				),
			).toBe(1);

			chapterSub.unsubscribe();

			expect(mock.client.unsubscribe).toHaveBeenCalledWith(
				'books/events/chapter/ch-1',
			);
			expect(mock.client.unsubscribe).not.toHaveBeenCalledWith(
				'books/events/book/book-1',
			);
			expect(
				(service as any).subscribedTopics.get(
					'books/events/book/book-1',
				),
			).toBe(1);

			bookSub.unsubscribe();

			expect(mock.client.unsubscribe).toHaveBeenCalledWith(
				'books/events/book/book-1',
			);
			expect(
				(service as any).subscribedTopics.has(
					'books/events/book/book-1',
				),
			).toBeFalse();
		});
	});
});
