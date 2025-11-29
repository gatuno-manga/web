import { Component } from '@angular/core';
import { SensitiveContentResponse } from '../../../models/book.models';
import { SensitiveContentService } from '../../../service/sensitive-content.service';
import { CheckboxComponent } from '../../../components/inputs/checkbox/checkbox.component';
import { TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { ListSwitchComponent } from '../../../components/inputs/list-switch/list-switch.component';
import { MetaDataService } from '../../../service/meta-data.service';
import { DownloadService } from '../../../service/download.service';

@Component({
  selector: 'app-filter',
  imports: [ListSwitchComponent],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss'
})
export class FilterComponent {
  sensitiveContentList: SensitiveContentResponse[] = [
    {
      id: '1',
      name: 'safe',
    }
  ]
  allowContent: string[] = [];

  constructor(
    private readonly sensitiveContentService: SensitiveContentService,
    private readonly metaService: MetaDataService,
    private readonly downloadService: DownloadService
  ) {
    this.loadSensitiveContent();
    this.allowContent = this.sensitiveContentService.getContentAllow();
    this.setMetaData();
  }

  loadSensitiveContent() {
    this.sensitiveContentService.getSensitiveContent().subscribe({
      next: (list) => {
        this.sensitiveContentList = [...this.sensitiveContentList, ...list];
      },
      error: async () => {
        try {
          const offlineBooks = await this.downloadService.getAllBooks();
          const contentMap = new Map<string, SensitiveContentResponse>();
          
          offlineBooks.forEach(book => {
            if (book.sensitiveContent) {
              book.sensitiveContent.forEach(sc => {
                contentMap.set(sc.id, sc);
              });
            }
          });
          
          const offlineList = Array.from(contentMap.values());
          // Remove duplicates that might be in initial list (like 'safe' if it comes from books too, though unlikely with id '1')
          // Actually, just appending unique ones found offline.
          this.sensitiveContentList = [...this.sensitiveContentList, ...offlineList];
        } catch (e) {
          console.error('Error loading offline sensitive content', e);
        }
      }
    });
  }

  setMetaData() {
    this.metaService.setMetaData({
      title: 'Filtro',
      description: 'Gerencie suas preferências de conteúdo sensível.',
    });
  }

  toggleContentAllow(content: SensitiveContentResponse): void {
    const index = this.allowContent.indexOf(content.name);
    if (index > -1) {
      this.allowContent.splice(index, 1);
    } else {
      this.allowContent.push(content.name);
    }
    this.sensitiveContentService.setContentAllow(this.allowContent);
  }
}
