import { Component, inject } from '@angular/core';
import { AppTheme, ThemeService } from '@core/services/theme.service';
import { IconsComponent } from '@ui/atoms/icons/icons.component';

@Component({
	selector: 'app-theme-setup-modal',
	standalone: true,
	imports: [IconsComponent],
	templateUrl: './theme-setup-modal.component.html',
	styleUrl: './theme-setup-modal.component.scss',
})
export class ThemeSetupModalComponent {
	public themeService = inject(ThemeService);

	themes: {
		id: AppTheme;
		label: string;
		icon: string;
		description: string;
	}[] = [
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
		{
			id: 'dracula',
			label: 'Dracula',
			icon: 'dracula',
			description:
				'Tema popular vibrante e focado em tons escuros arroxeados.',
		},
		{
			id: 'slate',
			label: 'Slate',
			icon: 'slate',
			description:
				'Tons de azul e ardósia elegantes, perfeitos para leitura noturna.',
		},
	];

	selectTheme(theme: AppTheme) {
		this.themeService.setTheme(theme);
	}
}
