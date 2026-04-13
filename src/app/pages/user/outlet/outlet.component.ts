import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NetworkStatusService } from '../../../service/network-status.service';
import { IconsComponent } from '../../../components/icons/icons.component';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { AuthService } from '../../../service/auth.service';
import { SearchService } from '../../../service/search.service';

@Component({
	selector: 'app-outlet',
	imports: [
		RouterModule,
		IconsComponent,
		ButtonComponent,
		TextInputComponent,
	],
	templateUrl: './outlet.component.html',
	styleUrl: './outlet.component.scss',
})
export class OutletComponent {
	readonly networkStatus = inject(NetworkStatusService);
	private readonly authService = inject(AuthService);
	private readonly router = inject(Router);
	readonly searchService = inject(SearchService);

	logout(): void {
		this.authService.logout().subscribe({
			next: () => {
				this.router.navigate(['/']);
			},
		});
	}

	updateSearch(event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.searchService.setQuery(val);
	}
}
