import { Injectable } from "@angular/core";
import { UserTokenService } from "../service/user-token.service";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";

@Injectable({
  providedIn: 'root',
})
export class AuthenticateGuard {
  constructor(
    private tokenService: UserTokenService,
    private router: Router,
  ) {}

  isLogged(route?: ActivatedRouteSnapshot, state?: RouterStateSnapshot): boolean {
    if (!this.tokenService.hasToken) {
      this.tokenService.refreshTokens().subscribe({
        next: () => {
          this.router.navigate(['']);
        },
        error: () => {
          const returnUrl = state?.url || '/';
          this.router.navigate(['/login'], { queryParams: { returnUrl } });
        }
      });
      return false;
    }
    return true;
  }

  isNotLogged(): boolean {
    if (this.tokenService.hasToken) {
      this.router.navigate(['']);
      return false;
    }
    return true;
  }
}
