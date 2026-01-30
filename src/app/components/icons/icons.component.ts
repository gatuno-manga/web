import { Component, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IconRegistryService } from '@service/icon-registry.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-icons',
  standalone: true,
  imports: [],
  templateUrl: './icons.component.html',
  styleUrl: './icons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--icon-size]': 'ensureUnits(size())',
    '[style.--icon-fill]': 'color()',
    '[style.--icon-stroke]': 'stroke() || null'
  }
})
export class IconsComponent {
  private registry = inject(IconRegistryService);
  private sanitizer = inject(DomSanitizer);

  name = input<string>();
  size = input<string>('24px');
  color = input<string>('currentColor');
  stroke = input<string>('1');
  background = input<string>('none');

  private svgRaw$ = toObservable(this.name).pipe(
    switchMap(name => name ? this.registry.getIcon(name) : of('')),
    map(svg => this.sanitizer.bypassSecurityTrustHtml(svg))
  );

  protected svgContent = toSignal(this.svgRaw$, { initialValue: '' });

  protected ensureUnits(value: string): string {
    return value && !isNaN(Number(value)) ? `${value}px` : value;
  }
}