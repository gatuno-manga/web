import { Component } from '@angular/core';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { AuthService } from '../../../service/auth.service';
import { Router } from '@angular/router';
import { MetaDataService } from '../../../service/meta-data.service';

@Component({
  selector: 'app-profile',
  imports: [ButtonComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly metaService: MetaDataService
  ) {
    this.setMetaData();
  }

  setMetaData() {
    this.metaService.setMetaData({
      title: 'Perfil',
      description: 'Gerencie seu perfil e configurações de conta.',
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/']);
      }
    });
  }
}
