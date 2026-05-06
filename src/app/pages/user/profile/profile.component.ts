import { Component, inject, input, computed, effect, signal } from '@angular/core';
import { ButtonComponent } from '@ui/atoms/inputs/button/button.component';
import { TextInputComponent } from '@ui/atoms/inputs/text-input/text-input.component';
import { AuthService } from '@core/services/auth.service';
import { Router } from '@angular/router';
import { MetaDataService } from '@core/services/meta-data.service';
import { SearchService } from '@core/services/search.service';
import { UserService } from '@core/services/user.service';
import {
	FormBuilder,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { FileInputComponent } from '@ui/molecules/file-input/file-input.component';

@Component({
	selector: 'app-profile',
	imports: [ReactiveFormsModule, ButtonComponent, TextInputComponent, FileInputComponent],
	templateUrl: './profile.component.html',
	styleUrl: './profile.component.scss',
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

	saveProfile(): void {
		if (this.profileForm.invalid || this.isLoading) return;

		this.isLoading = true;
		this.userService.updateProfile(this.profileForm.value).subscribe({
			next: () => {
				this.isLoading = false;
				this.profileForm.markAsPristine();
			},
			error: () => {
				this.isLoading = false;
			},
		});
	}

	onAvatarSelected(file: File | null): void {
		if (file) {
			this.isAvatarLoading.set(true);
			this.userService.uploadAvatar(file).subscribe({
				next: () => {
					this.isAvatarLoading.set(false);
				},
				error: () => {
					this.isAvatarLoading.set(false);
				},
			});
		}
	}

	onBannerSelected(file: File | null): void {
		if (file) {
			this.isBannerLoading.set(true);
			this.userService.uploadBanner(file).subscribe({
				next: () => {
					this.isBannerLoading.set(false);
				},
				error: () => {
					this.isBannerLoading.set(false);
				},
			});
		}
	}

	logout(): void {
		this.authService.logout().subscribe({
			next: () => {
				this.router.navigate(['/']);
			},
		});
	}
}

