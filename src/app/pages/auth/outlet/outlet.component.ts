import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { IconsComponent } from '../../../components/icons/icons.component';
import { ThemeToggleComponent } from '../../../components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-outlet',
  imports: [RouterModule, RouterOutlet, IconsComponent, ThemeToggleComponent],
  templateUrl: './outlet.component.html',
  styleUrl: './outlet.component.scss'
})
export class OutletComponent {

}
