import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReaderSettingsFormComponent } from '@features/reading/components/readers';

@Component({
	selector: 'app-reader-settings-notification',
	standalone: true,
	imports: [CommonModule, ReaderSettingsFormComponent],
	templateUrl: './reader-settings-notification.component.html',
	styleUrls: ['./reader-settings-notification.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderSettingsNotificationComponent {
	title = input('Configurações do Leitor');
	subtitle = input('Personalize sua experiência de leitura');
	showResetButton = input(true);
	contentType = input<'image' | 'text' | 'document' | 'all'>('image');
}
