import { Injectable, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class HeaderStateService {
	private isFixed = signal<boolean>(false);

	/**
	 * Signal que indica se o header deve ter comportamento estático
	 * true = position: static (header sai da tela ao rolar)
	 * false = position: sticky (header gruda no topo ao rolar - padrão)
	 */
	readonly isFixedSignal = this.isFixed.asReadonly();

	/**
	 * Define o comportamento do header
	 * @param fixed true para comportamento estático (sai da tela), false para sticky (gruda no topo)
	 */
	setFixed(fixed: boolean): void {
		this.isFixed.set(fixed);
	}
}
