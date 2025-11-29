import { Component, input, inject, effect, SecurityContext, ElementRef, viewChild, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IconRegistryService } from '@service/icon-registry.service';

@Component({
  selector: 'app-icons',
  imports: [],
  templateUrl: './icons.component.html',
  styleUrl: './icons.component.scss'
})
export class IconsComponent {
  private registry = inject(IconRegistryService);
  private sanitizer = inject(DomSanitizer);
  private el = inject(ElementRef);


  name = input<string>();
  size = input<string>('24px');
  color = input<string>('currentColor');
  stroke = input<string>('1');
  background = input<string>('none');

  protected svgContent = signal<SafeHtml>('');

  constructor() {
    effect(() => {
      const iconName = this.name();
      if (!iconName) return;

      this.registry.getIcon(iconName).subscribe({
        next: (svg) => {
          const safeSvg = this.sanitizer.bypassSecurityTrustHtml(svg);
          this.svgContent.set(safeSvg);
        },
        error: () => {
          this.svgContent.set('');
        }
      });
    });

    effect(() => {
      const style = this.el.nativeElement.style;

      style.setProperty('--icon-size', this.ensureUnits(this.size()));
      style.setProperty('--icon-fill', this.color());

      if (this.stroke()) {
        style.setProperty('--icon-stroke', this.stroke());
      } else {
        style.removeProperty('--icon-stroke');
      }
    });
  }

  private ensureUnits(value: string): string {
    return value && !isNaN(Number(value)) ? `${value}px` : value;
  }
}
