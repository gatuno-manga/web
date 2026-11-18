import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserTokenService } from '@core/services/auth/user-token.service';
import { Subject } from 'rxjs';
import { ReadingProgressService } from './reading-progress.service';
import { ReadingProgressSyncService } from './reading-progress-sync.service';
import { UnifiedReadingProgressService } from './unified-reading-progress.service';

describe('UnifiedReadingProgressService react to userIdSignal', () => {
	let readingService: UnifiedReadingProgressService;
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
			[
				'connect',
				'disconnect',
				'syncAll',
				'uploadProgress',
				'markChapterRead',
				'flushPendingReadMarks',
			],
			{
				progressSynced$: new Subject(),
				progressDeleted$: new Subject(),
				syncStatus: signal({ lastSyncAt: null }),
			},
		);
		syncServiceSpy.syncAll.and.returnValue(Promise.resolve());
		syncServiceSpy.uploadProgress.and.returnValue(Promise.resolve());
		syncServiceSpy.markChapterRead.and.returnValue(Promise.resolve());
		syncServiceSpy.flushPendingReadMarks.and.returnValue(Promise.resolve());

		const userTokenSpy = {
			userIdSignal: userIdSignal.asReadonly(),
			hasValidAccessTokenSignal: signal(false).asReadonly(),
			hasValidAccessToken: false,
		};

		TestBed.configureTestingModule({
			providers: [
				UnifiedReadingProgressService,
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
	});

	it('trocar userIdSignal de null para um id chama onUserLogin, e voltar para null chama onUserLogout', async () => {
		spyOn(readingService, 'onUserLogin').and.callThrough();
		spyOn(readingService, 'onUserLogout').and.callThrough();

		// Trocar userIdSignal de null para um id
		userIdSignal.set('user-123');
		TestBed.flushEffects();

		expect(readingService.onUserLogin).toHaveBeenCalledTimes(1);
		expect(readingService.onUserLogout).not.toHaveBeenCalled();

		// Voltar userIdSignal para null
		userIdSignal.set(null);
		TestBed.flushEffects();

		expect(readingService.onUserLogout).toHaveBeenCalledTimes(1);
	});

	it('markChapterRead delega para syncService', async () => {
		await readingService.markChapterRead('ch-auth');
		expect(syncServiceSpy.markChapterRead).toHaveBeenCalledWith('ch-auth');
	});

	it('onUserLogin dispara flushPendingReadMarks no syncService', async () => {
		const userToken = TestBed.inject(UserTokenService) as unknown as {
			accessToken: string | null;
		};
		const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
		const payload = btoa(JSON.stringify({ sub: 'user-123' }));
		userToken.accessToken = `${header}.${payload}.sig`;

		await readingService.onUserLogin();

		expect(syncServiceSpy.flushPendingReadMarks).toHaveBeenCalledTimes(1);
	});

	it('inicialização com token válido define usuário antes de chamar flushPendingReadMarks', () => {
		const callOrder: string[] = [];
		localProgressSpy.setCurrentUser.and.callFake((id) => {
			callOrder.push(`setCurrentUser:${id}`);
		});
		syncServiceSpy.flushPendingReadMarks.and.callFake(() => {
			callOrder.push('flushPendingReadMarks');
			return Promise.resolve();
		});

		const userToken = TestBed.inject(UserTokenService) as unknown as {
			accessToken: string | null;
			hasValidAccessToken: boolean;
		};
		const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
		const payload = btoa(JSON.stringify({ sub: 'user-startup' }));
		userToken.accessToken = `${header}.${payload}.sig`;
		userToken.hasValidAccessToken = true;

		// Instancia novamente para exercitar initializeUser() no construtor
		TestBed.runInInjectionContext(() => {
			new UnifiedReadingProgressService(
				'browser' as unknown as object,
				localProgressSpy,
				syncServiceSpy,
				userToken as unknown as UserTokenService,
			);
		});

		expect(callOrder).toEqual([
			'setCurrentUser:user-startup',
			'flushPendingReadMarks',
		]);
	});
});
