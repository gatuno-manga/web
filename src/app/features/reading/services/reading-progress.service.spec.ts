import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReadingProgressService } from './reading-progress.service';

describe('ReadingProgressService pending read marks', () => {
	let service: ReadingProgressService;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			providers: [
				ReadingProgressService,
				{ provide: PLATFORM_ID, useValue: 'browser' },
			],
		});
		service = TestBed.inject(ReadingProgressService);
		await service.removePendingReadMarks(['ch-1', 'ch-2'], 'user-a');
		await service.removePendingReadMarks(['ch-1', 'ch-2'], 'user-b');
	});

	it('should never enqueue or return pending read marks for guest users', async () => {
		service.setCurrentUser(null);
		await service.enqueuePendingReadMark('ch-guest');

		const guestMarks = await service.getPendingReadMarks();
		expect(guestMarks).toEqual([]);
	});

	it('should store, scope by userId, and remove pending read marks', async () => {
		service.setCurrentUser('user-a');
		await service.enqueuePendingReadMark('ch-1');
		await service.enqueuePendingReadMark('ch-2');

		service.setCurrentUser('user-b');
		await service.enqueuePendingReadMark('ch-1');

		const userAMarks = await service.getPendingReadMarks('user-a');
		expect(userAMarks.map((m) => m.chapterId).sort()).toEqual([
			'ch-1',
			'ch-2',
		]);

		const userBMarks = await service.getPendingReadMarks('user-b');
		expect(userBMarks.map((m) => m.chapterId)).toEqual(['ch-1']);

		await service.removePendingReadMarks(['ch-1'], 'user-a');
		const remainingUserA = await service.getPendingReadMarks('user-a');
		expect(remainingUserA.map((m) => m.chapterId)).toEqual(['ch-2']);

		const remainingUserB = await service.getPendingReadMarks('user-b');
		expect(remainingUserB.map((m) => m.chapterId)).toEqual(['ch-1']);
	});
});
