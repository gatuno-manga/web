import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
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
	@Input() title = 'Configurações do Leitor';
	@Input() subtitle = 'Personalize sua experiência de leitura';
	@Input() showResetButton = true;
	@Input() contentType: 'image' | 'text' | 'document' | 'all' = 'image';
}
