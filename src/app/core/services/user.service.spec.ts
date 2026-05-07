import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { UserTokenService } from './user-token.service';
import { UserProfile, Role } from '@models/user.models';
import { signal, WritableSignal } from '@angular/core';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  let userTokenServiceMock: { 
    hasValidAccessTokenSignal: WritableSignal<boolean>,
    hasValidAccessToken: boolean 
  };

  const mockProfile: UserProfile = {
    id: '1',
    email: 'test@example.com',
    userName: 'testuser',
    name: 'Test User',
    roles: [Role.USER],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeEach(() => {
    userTokenServiceMock = {
      hasValidAccessTokenSignal: signal(false),
      hasValidAccessToken: false
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        UserService,
        { provide: UserTokenService, useValue: userTokenServiceMock }
      ]
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch profile when user becomes authenticated', fakeAsync(() => {
    userTokenServiceMock.hasValidAccessTokenSignal.set(true);
    TestBed.flushEffects();
    tick();

    const req = httpMock.expectOne('/users/me');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockProfile });
    
    tick();
    expect(service.profileSignal()).toEqual(mockProfile);
  }));

  it('should clear profile when user logs out', fakeAsync(() => {
    // First set a profile
    (service as any)._profile.set(mockProfile);
    expect(service.profileSignal()).toEqual(mockProfile);

    // Act: Simulate logout
    userTokenServiceMock.hasValidAccessTokenSignal.set(false);
    TestBed.flushEffects();
    tick();

    expect(service.profileSignal()).toBeNull();
  }));

  describe('fetchMe', () => {
    it('should set profile on success', () => {
      service.fetchMe().subscribe(profile => {
        expect(profile).toEqual(mockProfile);
        expect(service.profileSignal()).toEqual(mockProfile);
      });

      const req = httpMock.expectOne('/users/me');
      req.flush({ data: mockProfile });
    });

    it('should set profile to null on error', () => {
      service.fetchMe().subscribe(profile => {
        expect(profile).toBeNull();
        expect(service.profileSignal()).toBeNull();
      });

      const req = httpMock.expectOne('/users/me');
      req.flush('Error', { status: 500, statusText: 'Server Error' });
    });
  });

  describe('updateProfile', () => {
    it('should update profile and local state', () => {
      const updateData = { name: 'New Name' };
      const updatedProfile = { ...mockProfile, ...updateData };

      service.updateProfile(updateData).subscribe(profile => {
        expect(profile).toEqual(updatedProfile);
        expect(service.profileSignal()).toEqual(updatedProfile);
      });

      const req = httpMock.expectOne('/users');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush({ data: updatedProfile });
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar and update local state', () => {
      const file = new File([''], 'avatar.png', { type: 'image/png' });
      const updatedProfile = { ...mockProfile, profileImageUrl: 'new-avatar-url' };

      service.uploadAvatar(file).subscribe(profile => {
        expect(profile).toEqual(updatedProfile);
        expect(service.profileSignal()).toEqual(updatedProfile);
      });

      const req = httpMock.expectOne('/users/me/avatar');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush({ data: updatedProfile });
    });
  });
});
