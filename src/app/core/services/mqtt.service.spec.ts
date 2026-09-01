import {
	HttpClientTestingModule,
	HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WebSocketConnectionState } from '@core/models/websocket-state.model';
import { ENVIRONMENT } from '@core/tokens/environment.token';
import { WINDOW } from '@core/tokens/window.token';
import mqtt, { MqttClient } from 'mqtt';
import { Subject } from 'rxjs';
import { MqttService } from './mqtt.service';
import { NetworkStatusService } from './network-status.service';
import { NotificationService } from './notification.service';
import { NotificationSettingsService } from './notification-settings.service';
import { UserTokenService } from './user-token.service';

describe('MqttService', () => {
	let service: MqttService;
	let _httpMock: HttpTestingController;
	let userTokenServiceSpy: jasmine.SpyObj<UserTokenService>;
	let networkStatusServiceSpy: jasmine.SpyObj<NetworkStatusService>;
	let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
	let notificationSettingsSpy: jasmine.SpyObj<NotificationSettingsService>;

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

		notificationSettingsSpy = jasmine.createSpyObj(
			'NotificationSettingsService',
			['areNotificationsEnabled'],
		);

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
					provide: NotificationSettingsService,
					useValue: notificationSettingsSpy,
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
});
