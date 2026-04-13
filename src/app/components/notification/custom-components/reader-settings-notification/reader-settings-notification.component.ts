import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReaderSettingsFormComponent } from '../../../readers';

@Component({
	selector: 'app-reader-settings-notification',
	standalone: true,
	imports: [CommonModule, ReaderSettingsFormComponent],
	templateUrl: './reader-settings-notification.component.html',
	styleUrls: ['./reader-settings-notification.component.scss'],
})
export class ReaderSettingsNotificationComponent {
	@Input() title = 'Configurações do Leitor';
	@Input() subtitle = 'Personalize sua experiência de leitura';
	@Input() showResetButton = true;
	@Input() contentType: 'image' | 'text' | 'document' | 'all' = 'image';
}
