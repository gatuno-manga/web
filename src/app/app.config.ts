import {
	provideHttpClient,
	withFetch,
	withInterceptors,
} from '@angular/common/http';
import {
	ApplicationConfig,
	importProvidersFrom,
	isDevMode,
	LOCALE_ID,
	provideZoneChangeDetection,
} from '@angular/core';
import {
	provideClientHydration,
	withEventReplay,
	withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { HttpClientRequestInterceptor } from '@core/interceptors/http-client-request.interceptor';
import { httpClientResponseInterceptor } from '@core/interceptors/http-client-response.interceptor';
import { NgxEchartsModule } from 'ngx-echarts';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(
			routes,
			withRouterConfig({ onSameUrlNavigation: 'reload' }),
		),
		provideClientHydration(
			withEventReplay(),
			withHttpTransferCacheOptions({ includePostRequests: false }),
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
		provideMarkdown(),
	],
};
