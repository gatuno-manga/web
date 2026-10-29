import {
	provideHttpClient,
	withFetch,
	withInterceptors,
} from '@angular/common/http';
import {
	ApplicationConfig,
	importProvidersFrom,
	inject,
	isDevMode,
	LOCALE_ID,
	provideZonelessChangeDetection,
} from '@angular/core';
import {
	provideClientHydration,
	withEventReplay,
	withHttpTransferCacheOptions,
	withNoIncrementalHydration,
} from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
	PreloadAllModules,
	provideRouter,
	withPreloading,
	withRouterConfig,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { HttpClientRequestInterceptor } from '@core/interceptors/http-client-request.interceptor';
import { httpClientResponseInterceptor } from '@core/interceptors/http-client-response.interceptor';
import { NotificationSettingsService } from '@core/services/notification-settings.service';
import { NOTIFICATIONS_ENABLED } from '@core/tokens/notifications-enabled.token';
import { NgxEchartsModule } from 'ngx-echarts';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZonelessChangeDetection(),
		provideRouter(
			routes,
			withRouterConfig({ onSameUrlNavigation: 'reload' }),
			withPreloading(PreloadAllModules),
		),
		provideClientHydration(
			withEventReplay(),
			withHttpTransferCacheOptions({ includePostRequests: false }),
			withNoIncrementalHydration(),
		),
		provideAnimationsAsync(),
		provideHttpClient(
			withFetch(),
			withInterceptors([
				HttpClientRequestInterceptor,
				httpClientResponseInterceptor,
			]),
		),
		provideServiceWorker('custom-sw.js', {
			enabled: !isDevMode(),
			registrationStrategy: 'registerWhenStable:30000',
		}),
		importProvidersFrom(
			NgxEchartsModule.forRoot({
				echarts: () => import('echarts'),
			}),
		),
		{ provide: LOCALE_ID, useValue: 'pt-BR' },
		{
			provide: NOTIFICATIONS_ENABLED,
			useFactory: () =>
				inject(NotificationSettingsService).enableAllNotifications,
		},
		provideMarkdown(),
	],
};
