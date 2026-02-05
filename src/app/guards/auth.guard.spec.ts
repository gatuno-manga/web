import { TestBed } from '@angular/core/testing';
import { isLoggedGuard } from './auth.guard';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

describe('AuthGuards', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideRouter([])]
		});
	});

	it('isLoggedGuard should be defined', () => {
		expect(isLoggedGuard).toBeDefined();
	});
});