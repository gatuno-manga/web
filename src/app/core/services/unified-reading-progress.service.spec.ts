import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ReadingProgressService } from './reading-progress.service';
import { ReadingProgressSyncService } from './reading-progress-sync.service';
import { SensitiveContentService } from './sensitive-content.service';
import { UnifiedReadingProgressService } from './unified-reading-progress.service';
import { UserTokenService } from './user-token.service';

describe('UnifiedReadingProgressService & SensitiveContentService react to userIdSignal', () => {
	let readingService: UnifiedReadingProgressService;
	let sensitiveContentService: SensitiveContentService;
	let userIdSignal = signal<string | null>(null);

	let localProgressSpy: jasmine.SpyObj<ReadingProgressService>;
	let syncServiceSpy: jasmine.SpyObj<ReadingProgressSyncService>;

	beforeEach(() => {
		userIdSignal = signal<string | null>(null);

		localProgressSpy = jasmine.createSpyObj('ReadingProgressService', [
			'setCurrentUser',
			'migrateGuestProgressToUser',
			'getAllProgress',
			'saveProgress',
			'deleteProgress',
		]);
		localProgressSpy.getAllProgress.and.returnValue(Promise.resolve([]));
		localProgressSpy.migrateGuestProgressToUser.and.returnValue(
			Promise.resolve(),
		);

		syncServiceSpy = jasmine.createSpyObj(
			'ReadingProgressSyncService',
			['connect', 'disconnect', 'syncAll', 'uploadProgress'],
			{
				progressSynced$: new Subject(),
				progressDeleted$: new Subject(),
				syncStatus: signal({ lastSyncAt: null }),
			},
		);
		syncServiceSpy.syncAll.and.returnValue(Promise.resolve());
		syncServiceSpy.uploadProgress.and.returnValue(Promise.resolve());

		const userTokenSpy = {
			userIdSignal: userIdSignal.asReadonly(),
			hasValidAccessTokenSignal: signal(false).asReadonly(),
		};

		TestBed.configureTestingModule({
			providers: [
				UnifiedReadingProgressService,
				SensitiveContentService,
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: ReadingProgressService, useValue: localProgressSpy },
				{
					provide: ReadingProgressSyncService,
					useValue: syncServiceSpy,
				},
				{ provide: UserTokenService, useValue: userTokenSpy },
			],
		});

		readingService = TestBed.inject(UnifiedReadingProgressService);
		sensitiveContentService = TestBed.inject(SensitiveContentService);
	});

	it('trocar userIdSignal de null para um id chama onUserLogin e invalidateCache uma vez, e voltar para null chama onUserLogout', async () => {
		spyOn(readingService, 'onUserLogin').and.callThrough();
		spyOn(readingService, 'onUserLogout').and.callThrough();
		spyOn(sensitiveContentService, 'invalidateCache').and.callThrough();

		// Trocar userIdSignal de null para um id
		userIdSignal.set('user-123');
		TestBed.flushEffects();

		expect(readingService.onUserLogin).toHaveBeenCalledTimes(1);
		expect(sensitiveContentService.invalidateCache).toHaveBeenCalledTimes(
			1,
		);
		expect(readingService.onUserLogout).not.toHaveBeenCalled();

		// Voltar userIdSignal para null
		userIdSignal.set(null);
		TestBed.flushEffects();

		expect(readingService.onUserLogout).toHaveBeenCalledTimes(1);
		expect(sensitiveContentService.invalidateCache).toHaveBeenCalledTimes(
			2,
		);
	});
});
