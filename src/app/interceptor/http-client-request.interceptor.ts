import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { UserTokenService } from '../service/user-token.service';
import { buildApiUrl } from '../utils/api-url.utils';

const DEVICE_ID_STORAGE_KEY = 'gatuno-device-id';

const resolveBrowserDeviceId = (): string => {
	const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
	if (existing && existing.trim().length > 0) {
		return existing;
	}

	const generated =
		window.crypto?.randomUUID?.() ??
		`web-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

	window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
	return generated;
};

const resolveBrowserDeviceName = (): string => {
	const nav = window.navigator as Navigator & {
		userAgentData?: { platform?: string };
	};
	return nav.userAgentData?.platform || nav.platform || 'web';
};

export const HttpClientRequestInterceptor: HttpInterceptorFn = (req, next) => {
	const userTokenService = inject(UserTokenService);
	const platformId = inject(PLATFORM_ID);
	const isBrowser = isPlatformBrowser(platformId);

	const requestUrl = buildApiUrl(req.url, {
		isBrowser,
		apiUrl: environment.apiURL,
		apiUrlServer: environment.apiURLServer,
		origin: isBrowser ? window.location.origin : undefined,
	});

	const authHeader = userTokenService.authHeaderSignal();
	let headers = req.headers;

	if (authHeader) {
		headers = headers.set('Authorization', authHeader);

		if (!isBrowser) {
			// SSR: forward only access token cookie managed by the client app
			const cookieParts: string[] = [];
			const accessToken = userTokenService.accessTokenSignal();
			if (accessToken) cookieParts.push(`accessToken=${accessToken}`);
			if (cookieParts.length > 0) {
				headers = headers.set('cookie', cookieParts.join('; '));
			}
		}
	}

	if (isBrowser) {
		headers = headers
			.set('x-client-platform', 'web')
			.set('x-device-id', resolveBrowserDeviceId())
			.set('x-device-name', resolveBrowserDeviceName());
	}

	const clonedRequest = req.clone({
		url: requestUrl,
		headers: headers,
	});

	return next(clonedRequest);
};
