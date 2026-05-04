import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { CookieService } from '../service/cookie.service';
import { CsrfService } from '../service/csrf.service';
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
		userAgentData?: { platform?: string; };
	};
	return nav.userAgentData?.platform || nav.platform || 'web';
};

export const HttpClientRequestInterceptor: HttpInterceptorFn = (req, next) => {
	const cookieService = inject(CookieService);
	const csrfService = inject(CsrfService);
	const platformId = inject(PLATFORM_ID);
	const isBrowser = isPlatformBrowser(platformId);

	const requestUrl = buildApiUrl(req.url, {
		isBrowser,
		apiUrl: environment.apiURL,
		apiUrlServer: environment.apiURLServer,
		origin: isBrowser ? window.location.origin : undefined,
	});

	const accessToken = cookieService.get('accessToken', false);
	const authHeader = accessToken ? `Bearer ${accessToken}` : null;
	const isRefreshRequest = req.url.includes('/auth/refresh');
	let headers = req.headers;

	if (authHeader && !isRefreshRequest) {
		headers = headers.set('Authorization', authHeader);

		if (!isBrowser) {
			// SSR: forward only access token cookie managed by the client app
			headers = headers.set('cookie', `accessToken=${accessToken}`);
		}
	}

	if (isBrowser) {
		headers = headers
			.set('x-client-platform', 'web')
			.set('x-device-id', resolveBrowserDeviceId())
			.set('x-device-name', resolveBrowserDeviceName());

		const mutableMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
		if (mutableMethods.includes(req.method)) {
			const csrfToken = csrfService.csrfToken;
			if (csrfToken) {
				headers = headers.set('x-csrf-token', csrfToken);
			}
		}
	}

	const clonedRequest = req.clone({
		url: requestUrl,
		headers: headers,
	});

	return next(clonedRequest);
};
