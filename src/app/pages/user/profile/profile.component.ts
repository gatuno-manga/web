import { Component, inject, input, computed, effect } from '@angular/core';
import { ButtonComponent } from '../../../components/inputs/button/button.component';
import { AuthService } from '../../../service/auth.service';
import { Router } from '@angular/router';
import { MetaDataService } from '../../../service/meta-data.service';
import { SearchService } from '../../../service/search.service';
import { UserService } from '../../../service/user.service';
import {
	FormBuilder,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';

@Component({
	selector: 'app-profile',
	imports: [ReactiveFormsModule, ButtonComponent],
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

	onAvatarSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		if (input.files?.length) {
			this.isLoading = true;
			this.userService.uploadAvatar(input.files[0]).subscribe({
				next: () => {
					this.isLoading = false;
				},
				error: () => {
					this.isLoading = false;
				},
			});
		}
	}

	onBannerSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		if (input.files?.length) {
			this.isLoading = true;
			this.userService.uploadBanner(input.files[0]).subscribe({
				next: () => {
					this.isLoading = false;
				},
				error: () => {
					this.isLoading = false;
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
