import {
	ApplicationConfig,
	LOCALE_ID,
	provideZoneChangeDetection,
	isDevMode,
} from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';

import { routes } from './app.routes';
import {
	provideClientHydration,
	withEventReplay,
} from '@angular/platform-browser';
import {
	provideHttpClient,
	withFetch,
	withInterceptors,
} from '@angular/common/http';
import { HttpClientRequestInterceptor } from './interceptor/http-client-request.interceptor';
import { httpClientResponseInterceptor } from './interceptor/http-client-response.interceptor';
import { importProvidersFrom } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { NgxEchartsModule } from 'ngx-echarts';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideMarkdown } from 'ngx-markdown';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(
			routes,
			withRouterConfig({ onSameUrlNavigation: 'reload' }),
		),
		provideClientHydration(withEventReplay()),
		provideAnimationsAsync(),
		provideHttpClient(
			withFetch(),
			withInterceptors([
				HttpClientRequestInterceptor,
				httpClientResponseInterceptor,
			]),
		),
		provideServiceWorker('ngsw-worker.js', {
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
