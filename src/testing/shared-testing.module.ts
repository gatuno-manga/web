import { NgModule } from '@angular/core';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

@NgModule({
    // Use RouterModule.forRoot([]) here instead of the deprecated RouterTestingModule.
    // This provides router directives for tests. If a test requires location mocks
    // or more advanced router testing utilities, add them per-test using
    // provideRouter()/provideLocationMocks() as needed.
    imports: [RouterModule.forRoot([])],
    exports: [RouterModule],
    providers: [provideHttpClient(), provideHttpClientTesting()]
})
export class SharedTestingModule {}
