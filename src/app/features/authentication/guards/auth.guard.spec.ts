import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { isLoggedGuard } from './auth.guard';

describe('AuthGuards', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideRouter([])],
		});
	});

	it('isLoggedGuard should be defined', () => {
		expect(isLoggedGuard).toBeDefined();
	});
});
