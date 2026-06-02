import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	signal,
} from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { MetaDataService } from '@core/services/meta-data.service';
import { SearchService } from '@core/services/search.service';
import { UserService } from '@core/services/user.service';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';
import { FileInputComponent } from '@ui/molecules/file-input/file-input.component';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'app-profile',
	imports: [
		ReactiveFormsModule,
		ButtonComponent,
		TextInputComponent,
		FileInputComponent,
	],
	templateUrl: './profile.component.html',
	styleUrl: './profile.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
	private readonly searchService = inject(SearchService);
	private readonly userService = inject(UserService);
	private readonly fb = inject(FormBuilder);

	isListView = input<boolean>(false);
	private globalSearchQuery = this.searchService.query;

	profileSignal = this.userService.profileSignal;
	profileForm: FormGroup;
	isLoading = false;
	isAvatarLoading = signal(false);
	isBannerLoading = signal(false);

	showPage = computed(() => {
		const q = this.globalSearchQuery().toLowerCase();
		return 'perfil usuário conta email'.includes(q);
	});

	constructor(
		private readonly authService: AuthService,
		private readonly router: Router,
		private readonly metaService: MetaDataService,
	) {
		this.setMetaData();
		this.profileForm = this.fb.group({
			userName: [
				'',
				[
					Validators.required,
					Validators.minLength(3),
					Validators.maxLength(50),
				],
			],
			name: ['', [Validators.maxLength(100)]],
		});

		effect(() => {
			const profile = this.userService.profileSignal();
			if (profile) {
				this.profileForm.patchValue({
					userName: profile.userName,
					name: profile.name || '',
				});
			}
		});
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Perfil',
			description: 'Gerencie seu perfil e configurações de conta.',
		});
	}

	async saveProfile(): Promise<void> {
		if (this.profileForm.invalid || this.isLoading) return;

		this.isLoading = true;
		try {
			await firstValueFrom(
				this.userService.updateProfile(this.profileForm.value),
			);
			this.profileForm.markAsPristine();
		} catch (error) {
			console.error('Error saving profile', error);
		} finally {
			this.isLoading = false;
		}
	}

	async onAvatarSelected(file: File | null): Promise<void> {
		if (file) {
			this.isAvatarLoading.set(true);
			try {
				await firstValueFrom(this.userService.uploadAvatar(file));
			} catch (error) {
				console.error('Error uploading avatar', error);
			} finally {
				this.isAvatarLoading.set(false);
			}
		}
	}

	async onBannerSelected(file: File | null): Promise<void> {
		if (file) {
			this.isBannerLoading.set(true);
			try {
				await firstValueFrom(this.userService.uploadBanner(file));
			} catch (error) {
				console.error('Error uploading banner', error);
			} finally {
				this.isBannerLoading.set(false);
			}
		}
	}

	async logout(): Promise<void> {
		try {
			await firstValueFrom(this.authService.logout());
			this.router.navigate(['/']);
		} catch (error) {
			console.error('Error logging out', error);
		}
	}
}
