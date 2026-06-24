import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IconsComponent } from '../icons/icons.component';

@Component({
	selector: 'app-icon-button',
	standalone: true,
	imports: [IconsComponent],
	templateUrl: './icon-button.component.html',
	styleUrl: './icon-button.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconButtonComponent {
	/** Nome do ícone (obrigatório) */
	name = input.required<string>();

	/** Tipo do botão ('button', 'submit', 'reset') */
	type = input<'button' | 'submit' | 'reset'>('button');

	/** Estado de desabilitado do botão */
	disabled = input<boolean>(false);

	/** Tamanho do ícone (ex: '24px') */
	size = input<string>('24px');

	/** Cor do ícone */
	color = input<string>('currentColor');

	/** Variante visual do botão */
	variant = input<'ghost' | 'overlay'>('ghost');

	/** Ativa o efeito de onda ao clicar */
	hasRipple = input<boolean>(true);

	/** Faz com que o botão fique transparente e só apareça no hover */
	hoverOnly = input<boolean>(false);

	/** Estado interno para gerenciar múltiplos ripples simulâneos */
	ripples = signal<{ x: number; y: number; id: number }[]>([]);
	private rippleId = 0;

	createRipple(event: MouseEvent) {
		if (!this.hasRipple() || this.disabled()) return;

		const button = event.currentTarget as HTMLElement;
		const rect = button.getBoundingClientRect();

		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const id = this.rippleId++;
		this.ripples.update((r) => [...r, { x, y, id }]);

		// Remove o ripple após a animação (600ms)
		setTimeout(() => {
			this.ripples.update((r) => r.filter((ripple) => ripple.id !== id));
		}, 600);
	}
}
