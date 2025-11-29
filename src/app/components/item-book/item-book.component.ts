import { Component, Input } from '@angular/core';

import { RouterModule } from '@angular/router';
import { BookList } from '../../models/book.models';

@Component({
  selector: 'app-item-book',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './item-book.component.html',
  styleUrl: './item-book.component.scss'
})
export class ItemBookComponent {
  @Input() book!: BookList;
  @Input() type: 'grid' | 'list' = 'grid';

}
