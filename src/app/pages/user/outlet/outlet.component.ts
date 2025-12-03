import { Component, Inject, PLATFORM_ID, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-outlet',
  imports: [RouterModule],
  templateUrl: './outlet.component.html',
  styleUrl: './outlet.component.scss'
})
export class OutletComponent implements OnInit, OnDestroy {
  isOffline = false;
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.isOffline = !navigator.onLine;
      
      // Ouvir mudanças de rede para reatividade dinâmica
      window.addEventListener('offline', this.updateOfflineStatus);
      window.addEventListener('online', this.updateOfflineStatus);
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('offline', this.updateOfflineStatus);
      window.removeEventListener('online', this.updateOfflineStatus);
    }
  }

  private updateOfflineStatus = () => {
    this.isOffline = !navigator.onLine;
  };
}
