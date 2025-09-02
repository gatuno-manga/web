import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BookList } from '../../models/book.models';

@Component({
  selector: 'app-item-book',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './item-book.component.html',
  styleUrl: './item-book.component.scss'
})
export class ItemBookComponent {
  @Input() book!: BookList;
  @Input() type: 'grid' | 'list' = 'grid';

}
