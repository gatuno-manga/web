import { Component } from '@angular/core';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { CheckboxComponent } from '../../../components/inputs/checkbox/checkbox.component';
import { SensitiveContentService } from '../../../service/sensitive-content.service';
import { AuthService } from '../../../service/auth.service';
import { Router } from '@angular/router';
import { SensitiveContentResponse } from '../../../models/book.models';

@Component({
  selector: 'app-profile',
  imports: [ButtonComponent, CheckboxComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  sensitiveContentList: SensitiveContentResponse[] = [
    {
      id: '1',
      name: 'safe',
    }
  ]
  allowContent: string[] = [];

  constructor(
    private readonly sensitiveContentService: SensitiveContentService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.sensitiveContentService.getSensitiveContent().subscribe((list) => {
      this.sensitiveContentList = [...this.sensitiveContentList, ...list];
    });
    this.allowContent = this.sensitiveContentService.getContentAllow();
  }

  toggleContentAllow(content: SensitiveContentResponse): void {
    const index = this.allowContent.indexOf(content.name);
    if (index > -1) {
      this.allowContent.splice(index, 1);
    } else {
      this.allowContent.push(content.name);
    }
    this.sensitiveContentService.setContentAllow(this.allowContent);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/']);
      }
    });
  }
}
