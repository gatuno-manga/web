import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NetworkStatusService } from './network-status.service';

describe('NetworkStatusService', () => {
	let service: NetworkStatusService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				NetworkStatusService,
				{ provide: PLATFORM_ID, useValue: 'browser' },
			],
		});

		service = TestBed.inject(NetworkStatusService);
	});

	afterEach(() => {
		service.ngOnDestroy();
	});

	it('should be created and report initial online status', () => {
		expect(service).toBeTruthy();
		expect(service.isOnline()).toBe(navigator.onLine);
		expect(service.isOffline()).toBe(!navigator.onLine);
	});

	it('should emit wentOffline$ when offline event is dispatched', (done) => {
		service.wentOffline$.subscribe(() => {
			expect(service.isOnline()).toBe(false);
			expect(service.isOffline()).toBe(true);
			done();
		});

		window.dispatchEvent(new Event('offline'));
	});

	it('should emit wentOnline$ when online event is dispatched after being offline', (done) => {
		// Simula estado offline inicial
		window.dispatchEvent(new Event('offline'));
		expect(service.isOnline()).toBe(false);

		service.wentOnline$.subscribe(() => {
			expect(service.isOnline()).toBe(true);
			expect(service.isOffline()).toBe(false);
			done();
		});

		// Transição para online
		window.dispatchEvent(new Event('online'));
	});

	it('should not emit wentOnline$ if already online', () => {
		let emitted = false;
		service.wentOnline$.subscribe(() => {
			emitted = true;
		});

		// Já está online (wasOffline = false)
		window.dispatchEvent(new Event('online'));
		expect(emitted).toBe(false);
	});
});
