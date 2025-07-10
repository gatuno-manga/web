import { CommonModule, isPlatformBrowser, isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Inject, Input, PLATFORM_ID } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
let fs: any;
if (typeof require !== 'undefined') {
  try {
    fs = require('fs');
  } catch {}
}

@Component({
  selector: 'app-icons',
  imports: [CommonModule],
  templateUrl: './icons.component.html',
  styleUrl: './icons.component.scss'
})
export class IconsComponent {
  @Input() name!: string;
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
  @Input() background: string = 'none';
  @Input() stroke: string = '2';
  @Input() modifier: boolean = true;

  svgContent: SafeHtml = '';

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnChanges(): void {
    this.loadIcon();
  }

  private loadIcon(): void {
    const iconPath = `/assets/icons/${this.name}.svg`;

    if (isPlatformBrowser(this.platformId)) {
      this.http.get(iconPath, { responseType: 'text' }).subscribe({
        next: (svg) => {
          svg = this.applySvgAttributes(svg);
          this.svgContent = this.sanitizer.bypassSecurityTrustHtml(svg);
        },
        error: (error) => {
          console.error(`Erro ao carregar o ícone: ${this.name}`, error);
        }
      });
    } else if (isPlatformServer(this.platformId) && fs) {
      try {
        const serverIconPath = `./dist/front/browser/assets/icons/${this.name}.svg`;
        let svg = fs.readFileSync(serverIconPath, 'utf8');
        svg = this.applySvgAttributes(svg);
        this.svgContent = this.sanitizer.bypassSecurityTrustHtml(svg);
      } catch (error) {
        console.error(`Erro ao carregar o ícone no SSR: ${this.name}`, error);
      }
    }
  }

  private applySvgAttributes(svg: string): string {
    svg = svg
      .replace(/width=".*?"/, `width="${this.size}"`)
      .replace(/height=".*?"/, `height="${this.size}"`)
    if (this.modifier) {
      svg = svg
        .replace(/stroke=".*?"/, `stroke="${this.color}"`)
        .replace(/fill=".*?"/, `fill="${this.background}"`)
        .replace(/stroke-width=".*?"/, `stroke-width="${this.stroke}"`);
    }
    return svg;
  }
}
