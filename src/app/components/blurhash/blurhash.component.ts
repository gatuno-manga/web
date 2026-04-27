import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { decode } from 'blurhash';

@Component({
  selector: 'app-blurhash',
  standalone: true,
  templateUrl: './blurhash.component.html',
  styleUrl: './blurhash.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlurhashComponent implements AfterViewInit, OnChanges {
  @Input() hash?: string;
  @Input() width: number = 32;
  @Input() height: number = 32;
  @Input() punch: number = 1;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit() {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['hash'] || changes['width'] || changes['height']) && this.canvasRef) {
      this.render();
    }
  }

  private render() {
    if (!this.hash) return;

    try {
      const canvas = this.canvasRef.nativeElement;
      
      // Always decode to a small resolution for performance
      // If we have large metadata dimensions, we don't want to decode at that size
      const decodeWidth = 32;
      const decodeHeight = this.width && this.height 
        ? Math.round(32 * (this.height / this.width))
        : 32;

      const pixels = decode(this.hash, decodeWidth, decodeHeight, this.punch);
      
      canvas.width = decodeWidth;
      canvas.height = decodeHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.createImageData(decodeWidth, decodeHeight);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (error) {
      console.error('Error rendering blurhash:', error);
    }
  }
}
