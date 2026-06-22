import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
	ScrollRestorationService,
	ScrollRestorationState,
} from './scroll-restoration.service';

describe('ScrollRestorationService', () => {
	let service: ScrollRestorationService;
	const storagePrefix = '@gatuno/scroll';

	beforeEach(() => {
		sessionStorage.clear();

		TestBed.configureTestingModule({
			providers: [
				ScrollRestorationService,
				{ provide: PLATFORM_ID, useValue: 'browser' },
			],
		});
		service = TestBed.inject(ScrollRestorationService);
	});

	afterEach(() => {
		sessionStorage.clear();
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('save()', () => {
		it('should store scrollY in sessionStorage', () => {
			spyOnProperty(window, 'scrollY').and.returnValue(500);

			service.save('test-key');

			const raw = sessionStorage.getItem(`${storagePrefix}/test-key`);
			expect(raw).not.toBeNull();
			const parsed = JSON.parse(raw!);
			expect(parsed.scrollY).toBe(500);
		});

		it('should include extra data when provided', () => {
			spyOnProperty(window, 'scrollY').and.returnValue(200);

			service.save('test-key', { infiniteScrollPage: 3 });

			const raw = sessionStorage.getItem(`${storagePrefix}/test-key`);
			const parsed = JSON.parse(raw!);
			expect(parsed.infiniteScrollPage).toBe(3);
		});
	});

	describe('get()', () => {
		it('should return null when no data is saved', () => {
			expect(service.get('missing-key')).toBeNull();
		});

		it('should deserialize saved state', () => {
			const state: ScrollRestorationState = {
				scrollY: 800,
				infiniteScrollPage: 2,
			};
			sessionStorage.setItem(
				`${storagePrefix}/test-key`,
				JSON.stringify(state),
			);

			const result = service.get('test-key');

			expect(result).toEqual(state);
		});
	});

	describe('consume()', () => {
		it('should return state and remove entry from sessionStorage', () => {
			const state: ScrollRestorationState = { scrollY: 300 };
			sessionStorage.setItem(
				`${storagePrefix}/test-key`,
				JSON.stringify(state),
			);

			const result = service.consume('test-key');

			expect(result).toEqual(state);
			expect(sessionStorage.getItem(`${storagePrefix}/test-key`)).toBeNull();
		});

		it('should return null when key does not exist', () => {
			expect(service.consume('missing-key')).toBeNull();
		});
	});

	describe('clear()', () => {
		it('should remove entry from sessionStorage', () => {
			const state: ScrollRestorationState = { scrollY: 100 };
			sessionStorage.setItem(
				`${storagePrefix}/test-key`,
				JSON.stringify(state),
			);

			service.clear('test-key');

			expect(sessionStorage.getItem(`${storagePrefix}/test-key`)).toBeNull();
		});
	});

	describe('restoreAfterRender()', () => {
		beforeEach(() => {
			jasmine.clock().install();
		});

		afterEach(() => {
			jasmine.clock().uninstall();
		});

		it('should not call scrollTo when scrollY is 0', () => {
			const scrollSpy = spyOn(window, 'scrollTo');
			service.restoreAfterRender(0);
			jasmine.clock().tick(500);
			expect(scrollSpy).not.toHaveBeenCalled();
		});

		it('should call window.scrollTo after the initial delay', (done) => {
			const scrollSpy = spyOn(window, 'scrollTo');
			spyOnProperty(window, 'scrollY').and.returnValue(1000);

			service.restoreAfterRender(1000);

			// Advance past the 250ms initial delay then wait for rAF
			jasmine.clock().tick(300);
			requestAnimationFrame(() => {
				expect(scrollSpy).toHaveBeenCalled();
				done();
			});
		});
	});
});
