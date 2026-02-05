import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NetworkStatusService } from '../../../service/network-status.service';

@Component({
  selector: 'app-outlet',
  imports: [RouterModule],
  templateUrl: './outlet.component.html',
  styleUrl: './outlet.component.scss'
})
export class OutletComponent {
  readonly networkStatus = inject(NetworkStatusService);
}
