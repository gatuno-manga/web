import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { NetworkStatusService } from '@core/services/network-status.service';
import { SearchService } from '@core/services/search.service';
import { UserTokenService } from '@core/services/user-token.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';

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
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutletComponent {
	readonly networkStatus = inject(NetworkStatusService);
	private readonly authService = inject(AuthService);
	private readonly router = inject(Router);
	readonly searchService = inject(SearchService);
	readonly userTokenService = inject(UserTokenService);

	async logout(): Promise<void> {
		try {
			await firstValueFrom(this.authService.logout());
			this.router.navigate(['/']);
		} catch (error) {
			console.error('Logout failed', error);
		}
	}

	updateSearch(event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.searchService.setQuery(val);
	}
}
