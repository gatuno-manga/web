import { Directive, ElementRef, HostListener, input, Renderer2, inject, OnDestroy } from '@angular/core';

@Directive({
	selector: '[appTooltip]',
	standalone: true
})
export class TooltipDirective implements OnDestroy {
	appTooltip = input<string>('');
	
	private el = inject(ElementRef);
	private renderer = inject(Renderer2);
	private tooltipElement: HTMLElement | null = null;
	private timeoutId: any;

	@HostListener('mouseenter') onMouseEnter() {
		if (!this.appTooltip()) return;
		
		// Pequeno delay para exibir, como MangaDex
		this.timeoutId = setTimeout(() => {
			this.createTooltip();
		}, 200);
	}

	@HostListener('mouseleave') onMouseLeave() {
		clearTimeout(this.timeoutId);
		this.removeTooltip();
	}
	
	@HostListener('click') onClick() {
		clearTimeout(this.timeoutId);
		this.removeTooltip();
	}

	private createTooltip() {
		if (this.tooltipElement) return;

		this.tooltipElement = this.renderer.createElement('div');
		const text = this.renderer.createText(this.appTooltip());
		this.renderer.appendChild(this.tooltipElement, text);
		
		this.renderer.addClass(this.tooltipElement, 'gatuno-custom-tooltip');
		this.renderer.appendChild(document.body, this.tooltipElement);
		
		const hostPos = this.el.nativeElement.getBoundingClientRect();
		const tooltipPos = this.tooltipElement!.getBoundingClientRect();
		
		// Centraliza o tooltip em cima do elemento
		const top = hostPos.top - tooltipPos.height - 10;
		const left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
		
		this.renderer.setStyle(this.tooltipElement, 'top', `${top + window.scrollY}px`);
		this.renderer.setStyle(this.tooltipElement, 'left', `${left + window.scrollX}px`);
		
		// Trigger animação no próximo frame
		requestAnimationFrame(() => {
			this.renderer.addClass(this.tooltipElement, 'show');
		});
	}

	private removeTooltip() {
		if (this.tooltipElement) {
			const el = this.tooltipElement;
			this.renderer.removeClass(el, 'show');
			setTimeout(() => {
				if (el.parentNode) {
					this.renderer.removeChild(document.body, el);
				}
			}, 200); // Mesmo tempo do transition no CSS
			this.tooltipElement = null;
		}
	}

	ngOnDestroy() {
		clearTimeout(this.timeoutId);
		if (this.tooltipElement && this.tooltipElement.parentNode) {
			this.renderer.removeChild(document.body, this.tooltipElement);
		}
	}
}
