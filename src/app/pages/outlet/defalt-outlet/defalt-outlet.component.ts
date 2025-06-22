import { Component } from '@angular/core';
import { HeaderComponent } from '../../../components/header/header.component';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-defalt-outlet',
  imports: [HeaderComponent, RouterModule, RouterOutlet],
  templateUrl: './defalt-outlet.component.html',
  styleUrl: './defalt-outlet.component.scss'
})
export class DefaltOutletComponent {

}
