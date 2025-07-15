import { Component } from '@angular/core';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { CheckboxComponent } from '../../../components/inputs/checkbox/checkbox.component';
import { SensitiveContent } from '../../../models/book.models';
import { SensitiveContentService } from '../../../service/sensitive-content.service';
import { AuthService } from '../../../service/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  imports: [ButtonComponent, CheckboxComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  sensitiveContentList: SensitiveContent[] = Object.values(SensitiveContent);
  allowContent: SensitiveContent[] = [];

  constructor(
    private readonly sensitiveContentService: SensitiveContentService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.allowContent = this.sensitiveContentService.getContentAllow();
  }

  toggleContentAllow(content: SensitiveContent): void {
    const index = this.allowContent.indexOf(content);
    if (index > -1) {
      this.allowContent.splice(index, 1);
    } else {
      this.allowContent.push(content);
    }
    this.sensitiveContentService.setContentAllow(this.allowContent);
  }

  getSensitiveContentLabel(content: SensitiveContent): string {
    switch (content) {
      case SensitiveContent.SAFE:
        return 'Seguro';
      case SensitiveContent.GORE:
        return 'Gore';
      case SensitiveContent.SUGGESTIVE:
        return 'Susgestivo';
      case SensitiveContent.EROTIC:
        return 'Erotico';
      case SensitiveContent.PORNOGRAFIC:
        return 'Pornográfico';
      default:
        return 'Unknown';
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/']);
      }
    });
  }
}
