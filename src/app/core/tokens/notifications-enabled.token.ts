import { InjectionToken, Signal, signal } from '@angular/core';

export const NOTIFICATIONS_ENABLED = new InjectionToken<Signal<boolean>>(
	'NOTIFICATIONS_ENABLED',
	{
		providedIn: 'root',
		factory: () => signal(true),
	},
);
