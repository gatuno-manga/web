import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { SensitiveContentResponse } from '../../../models/book.models';
import { SensitiveContentService } from '../../../service/sensitive-content.service';
import { ListSwitchComponent } from '../../../components/inputs/list-switch/list-switch.component';
import { MetaDataService } from '../../../service/meta-data.service';
import { DownloadService } from '../../../service/download.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [ListSwitchComponent],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterComponent implements OnInit {
  private readonly sensitiveContentService = inject(SensitiveContentService);
  private readonly metaService = inject(MetaDataService);
  private readonly downloadService = inject(DownloadService);

  sensitiveContentList = signal<SensitiveContentResponse[]>([{ id: '1', name: 'safe' }]);
  allowContent = signal<string[]>([]);
  isLoading = signal<boolean>(false);

  ngOnInit() {
    this.allowContent.set(this.sensitiveContentService.getContentAllow());
    this.loadSensitiveContent();
    this.setMetaData();
  }

  loadSensitiveContent() {
    this.isLoading.set(true);
    this.sensitiveContentService.getSensitiveContent()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (list) => {
          this.sensitiveContentList.update(current => [...current, ...list]);
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
            this.sensitiveContentList.update(current => [...current, ...offlineList]);
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
    this.allowContent.update(current => {
      const index = current.indexOf(content.name);
      const newList = [...current];
      if (index > -1) {
        newList.splice(index, 1);
      } else {
        newList.push(content.name);
      }
      this.sensitiveContentService.setContentAllow(newList);
      return newList;
    });
  }
}
