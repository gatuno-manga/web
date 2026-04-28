import { Component, inject } from '@angular/core';
import { ThemeService, AppTheme } from '../../service/theme.service';
import { IconsComponent } from '../icons/icons.component';

@Component({
	selector: 'app-theme-setup-modal',
	standalone: true,
	imports: [IconsComponent],
	templateUrl: './theme-setup-modal.component.html',
	styleUrl: './theme-setup-modal.component.scss',
})
export class ThemeSetupModalComponent {
	public themeService = inject(ThemeService);

	themes: { id: AppTheme; label: string; icon: string; description: string }[] = [
		{
			id: 'light',
			label: 'Claro',
			icon: 'sun',
			description: 'Ideal para ambientes bem iluminados.',
		},
		{
			id: 'dark',
			label: 'Escuro',
			icon: 'moon',
			description: 'Confortável para os olhos em ambientes escuros.',
		},
		{
			id: 'true-dark',
			label: 'True Dark',
			icon: 'contrast',
			description: 'Preto puro para economizar bateria em telas OLED.',
		},
	];

	selectTheme(theme: AppTheme) {
		this.themeService.setTheme(theme);
	}
}
