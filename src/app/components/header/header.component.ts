import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule, RouterOutlet } from '@angular/router';
import { ThemetToggleComponent } from '../theme-toggle/theme-toggle.component';
import { IconsComponent } from '../icons/icons.component';

@Component({
  selector: 'app-header',
  imports: [RouterModule, IconsComponent, ThemetToggleComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  backPage() {
    this.location.back();
  }

}
