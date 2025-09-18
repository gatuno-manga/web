import { Injectable } from "@angular/core";
import { UserTokenService } from "../service/user-token.service";
import { Router } from "@angular/router";

@Injectable({
  providedIn: 'root',
})
export class AuthenticateGuard {
  constructor(
    private tokenService: UserTokenService,
    private router: Router,
  ) {}

  isLogged(): boolean {
    if (!this.tokenService.hasToken) {
      this.tokenService.refreshTokens().subscribe({
        next: () => {
          this.router.navigate(['']);
        },
        error: () => {
          this.router.navigate(['/login']);
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
