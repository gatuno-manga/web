import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-outlet',
	imports: [RouterModule, RouterOutlet, IconsComponent],
	templateUrl: './outlet.component.html',
	styleUrl: './outlet.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutletComponent {}
