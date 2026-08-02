import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
	selector: 'img[appImageFallback]',
	standalone: true,
})
export class ImageFallbackDirective {
	private el = inject(ElementRef<HTMLImageElement>);

	@HostListener('error')
	onError() {
		this.el.nativeElement.style.display = 'none';
	}
}
