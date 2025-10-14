import { TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '../../testing/shared-testing.module';
import { AuthenticateGuard } from './auth.guard';

describe('AuthenticateGuard', () => {
  let guard: AuthenticateGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SharedTestingModule] });
    guard = TestBed.inject(AuthenticateGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
