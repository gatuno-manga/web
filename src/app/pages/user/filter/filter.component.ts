import { Component } from '@angular/core';
import { SensitiveContentResponse } from '../../../models/book.models';
import { SensitiveContentService } from '../../../service/sensitive-content.service';
import { CheckboxComponent } from '../../../components/inputs/checkbox/checkbox.component';
import { TextInputComponent } from '../../../components/inputs/text-input/text-input.component';
import { ListSwitchComponent } from '../../../components/inputs/list-switch/list-switch.component';

@Component({
  selector: 'app-filter',
  imports: [TextInputComponent, CheckboxComponent, ListSwitchComponent],
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
  ) {
    this.sensitiveContentService.getSensitiveContent().subscribe((list) => {
      this.sensitiveContentList = [...this.sensitiveContentList, ...list];
    });
    this.allowContent = this.sensitiveContentService.getContentAllow();
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
