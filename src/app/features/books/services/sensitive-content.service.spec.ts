import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CookieService } from '@core/services/auth/cookie.service';
import { UserTokenService } from '@core/services/auth/user-token.service';
import { SensitiveContentService } from './sensitive-content.service';

describe('SensitiveContentService react to userIdSignal', () => {
	let sensitiveContentService: SensitiveContentService;
	let userIdSignal = signal<string | null>(null);

	beforeEach(() => {
		userIdSignal = signal<string | null>(null);

		const userTokenSpy = {
			userIdSignal: userIdSignal.asReadonly(),
			hasValidAccessTokenSignal: signal(false).asReadonly(),
		};

		const cookieSpy = jasmine.createSpyObj('CookieService', [
			'get',
			'set',
			'delete',
		]);
		cookieSpy.get.and.returnValue(null);

		TestBed.configureTestingModule({
			providers: [
				SensitiveContentService,
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: UserTokenService, useValue: userTokenSpy },
				{ provide: CookieService, useValue: cookieSpy },
			],
		});

		sensitiveContentService = TestBed.inject(SensitiveContentService);
	});

	it('trocar userIdSignal chama invalidateCache', () => {
		spyOn(sensitiveContentService, 'invalidateCache').and.callThrough();

		userIdSignal.set('user-123');
		TestBed.flushEffects();

		expect(sensitiveContentService.invalidateCache).toHaveBeenCalledTimes(
			1,
		);

		userIdSignal.set(null);
		TestBed.flushEffects();

		expect(sensitiveContentService.invalidateCache).toHaveBeenCalledTimes(
			2,
		);
	});
});
