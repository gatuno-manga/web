import { Component, Input } from '@angular/core';

import { RouterModule } from '@angular/router';
import { BookList } from '../../models/book.models';
import { IconsComponent } from '../icons/icons.component';

@Component({
  selector: 'app-item-book',
  standalone: true,
  imports: [RouterModule, IconsComponent],
  templateUrl: './item-book.component.html',
  styleUrl: './item-book.component.scss'
})
export class ItemBookComponent {
  @Input() book!: BookList;
  @Input() type: 'grid' | 'list' = 'grid';

  imageError = false;

  onImageError() {
    this.imageError = true;
  }
}
