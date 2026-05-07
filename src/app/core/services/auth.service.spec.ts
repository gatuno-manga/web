import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { UserTokenService } from './user-token.service';
import { UnifiedReadingProgressService } from './unified-reading-progress.service';
import { loginRequest, loginResponse, registerRequest, authTokensResponse } from '@models/user.models';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let userTokenServiceSpy: jasmine.SpyObj<UserTokenService>;
  let readingProgressServiceSpy: jasmine.SpyObj<UnifiedReadingProgressService>;

  beforeEach(() => {
    const userTokenSpy = jasmine.createSpyObj('UserTokenService', ['setTokens', 'removeTokens'], {
        csrfToken: 'mock-csrf'
    });
    const readingProgressSpy = jasmine.createSpyObj('UnifiedReadingProgressService', ['onUserLogin', 'onUserLogout']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: UserTokenService, useValue: userTokenSpy },
        { provide: UnifiedReadingProgressService, useValue: readingProgressSpy }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    userTokenServiceSpy = TestBed.inject(UserTokenService) as jasmine.SpyObj<UserTokenService>;
    readingProgressServiceSpy = TestBed.inject(UnifiedReadingProgressService) as jasmine.SpyObj<UnifiedReadingProgressService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should call signin endpoint and set tokens on success', () => {
      const mockReq: loginRequest = { email: 'test@example.com', password: 'password' };
      const mockRes: loginResponse = { 
        accessToken: 'access', 
        csrfToken: 'csrf'
      };

      service.login(mockReq).subscribe(response => {
        expect(response.body).toEqual(mockRes);
        expect(userTokenServiceSpy.setTokens).toHaveBeenCalledWith('access', 'csrf');
        expect(readingProgressServiceSpy.onUserLogin).toHaveBeenCalled();
      });

      const req = httpMock.expectOne('/auth/signin');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      req.flush(mockRes);
    });
  });

  describe('verifyMfaLogin', () => {
    it('should call verify-login endpoint and set tokens on success', () => {
      const mockRes: authTokensResponse = { accessToken: 'access', csrfToken: 'csrf' };

      service.verifyMfaLogin('mfa-token', '123456').subscribe(response => {
        expect(response.body).toEqual(mockRes);
        expect(userTokenServiceSpy.setTokens).toHaveBeenCalledWith('access', 'csrf');
        expect(readingProgressServiceSpy.onUserLogin).toHaveBeenCalled();
      });

      const req = httpMock.expectOne('/auth/mfa/verify-login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ mfaToken: 'mfa-token', code: '123456' });
      req.flush(mockRes);
    });
  });

  describe('logout', () => {
    it('should call logout endpoint and remove tokens', () => {
      service.logout().subscribe(() => {
        expect(userTokenServiceSpy.removeTokens).toHaveBeenCalled();
        expect(readingProgressServiceSpy.onUserLogout).toHaveBeenCalled();
      });

      const req = httpMock.expectOne('/auth/logout');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('x-csrf-token')).toBe('mock-csrf');
      req.flush({});
    });
  });

  describe('register', () => {
    it('should call signup endpoint and set tokens on success', () => {
      const mockReq: registerRequest = { email: 'new@example.com', password: 'password' };
      const mockRes: authTokensResponse = { accessToken: 'access', csrfToken: 'csrf' };

      service.register(mockReq).subscribe(response => {
        expect(response.body).toEqual(mockRes);
        expect(userTokenServiceSpy.setTokens).toHaveBeenCalledWith('access', 'csrf');
        expect(readingProgressServiceSpy.onUserLogin).toHaveBeenCalled();
      });

      const req = httpMock.expectOne('/auth/signup');
      expect(req.request.method).toBe('POST');
      req.flush(mockRes);
    });
  });

  describe('passkeys', () => {
    it('beginPasskeyAuthentication should call options endpoint', () => {
      service.beginPasskeyAuthentication('test@example.com').subscribe();
      const req = httpMock.expectOne('/auth/passkeys/authenticate/options');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@example.com' });
      req.flush({});
    });

    it('verifyPasskeyAuthentication should call verify endpoint and set tokens', () => {
      const mockRes: loginResponse = { 
        accessToken: 'access', 
        csrfToken: 'csrf'
      };

      service.verifyPasskeyAuthentication('test@example.com', { id: 'cred' }).subscribe(response => {
        expect(userTokenServiceSpy.setTokens).toHaveBeenCalledWith('access', 'csrf');
        expect(readingProgressServiceSpy.onUserLogin).toHaveBeenCalled();
      });

      const req = httpMock.expectOne('/auth/passkeys/authenticate/verify');
      expect(req.request.method).toBe('POST');
      req.flush(mockRes);
    });
  });
});
