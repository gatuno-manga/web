import { Component } from '@angular/core';
import { MetaDataService } from '../../service/meta-data.service';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  constructor(private metaService: MetaDataService) {
    this.setMetaData();
  }

  setMetaData() {
    this.metaService.setMetaData({
      title: 'Home',
      description: 'Bem-vindo à nossa plataforma. Explore livros, autores e muito mais.',
    });
  }
}
