import { TestBed } from '@angular/core/testing';
import { HttpClientRequestInterceptor } from './http-client-request.interceptor';

describe('HttpClientRequestInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be defined', () => {
    expect(HttpClientRequestInterceptor).toBeDefined();
  });
});
