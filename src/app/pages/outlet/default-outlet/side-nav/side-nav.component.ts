import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconsComponent } from '../../../../components/icons/icons.component';

interface NavItem {
	label: string;
	icon: string;
	route: string;
}

interface NavGroup {
	items: NavItem[];
}

@Component({
	selector: 'app-side-nav',
	standalone: true,
	imports: [RouterModule, IconsComponent],
	templateUrl: './side-nav.component.html',
	styleUrl: './side-nav.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavComponent {
	close = output<void>();

	navGroups: NavGroup[] = [
		{
			items: [
				{ label: 'Home', icon: 'grid', route: '/' },
				{ label: 'Livros', icon: 'file-text', route: '/books' },
				{ label: 'Perfil', icon: 'user', route: '/user' },
			],
		},
		{
			items: [
				{ label: 'Ultimas leituras', icon: 'clock', route: '#' },
				{ label: 'Livro aleatório', icon: 'shuffle', route: '#' },
			],
		},
		{
			items: [{ label: 'Dashboard', icon: 'grid', route: '/dashboard' }],
		},
	];

	onClose() {
		this.close.emit();
	}
}
