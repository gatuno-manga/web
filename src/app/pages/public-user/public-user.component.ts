import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PublicUserService } from '../../service/public-user.service';
import {
	PublicUserCollection,
	PublicUserProfile,
	PublicUserSavedPage,
} from '../../models/public-user.models';
import { MetaDataService } from '../../service/meta-data.service';

@Component({
	selector: 'app-public-user',
	standalone: true,
	imports: [RouterModule, DatePipe],
	templateUrl: './public-user.component.html',
	styleUrl: './public-user.component.scss',
})
export class PublicUserComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly publicUserService = inject(PublicUserService);
	private readonly metaService = inject(MetaDataService);

	isLoading = signal<boolean>(true);
	profile = signal<PublicUserProfile | null>(null);
	collections = signal<PublicUserCollection[]>([]);
	savedPages = signal<PublicUserSavedPage[]>([]);
	errorMessage = signal<string>('');

	ngOnInit(): void {
		this.route.paramMap.subscribe((params) => {
			const userId = params.get('userId');
			if (!userId) {
				this.errorMessage.set('Usuario nao encontrado.');
				this.isLoading.set(false);
				return;
			}

			this.loadUserData(userId);
		});
	}

	private loadUserData(userId: string): void {
		this.isLoading.set(true);
		this.errorMessage.set('');

		this.publicUserService.getPublicUserBundle(userId).subscribe({
			next: (bundle) => {
				this.profile.set(bundle.profile);
				this.collections.set(bundle.collections);
				this.savedPages.set(bundle.savedPages);
				this.metaService.setMetaData({
					title: `Perfil de ${bundle.profile.userName}`,
					description: `Informacoes publicas de ${bundle.profile.userName}`,
					image: bundle.profile.profileImageUrl || '',
				});
				this.isLoading.set(false);
			},
			error: () => {
				this.errorMessage.set(
					'Nao foi possivel carregar os dados publicos do usuario.',
				);
				this.isLoading.set(false);
			},
		});
	}
}
