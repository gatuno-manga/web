import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HeaderComponent } from '../../../components/header/header.component';
import { RouterModule, RouterOutlet } from '@angular/router';
import { HeaderStateService } from '../../../service/header-state.service';

@Component({
	selector: 'app-default-outlet',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [HeaderComponent, RouterModule, RouterOutlet],
	templateUrl: './default-outlet.component.html',
	styleUrl: './default-outlet.component.scss',
})
export class DefaultOutletComponent {
	protected headerState = inject(HeaderStateService);
}
