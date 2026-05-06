import { InjectionToken } from '@angular/core';

/**
 * Token de injeção para o objeto Window do navegador.
 *
 * Fornece acesso seguro ao objeto `window` do navegador, com fallback
 * para SSR (Server-Side Rendering) que retorna um objeto vazio.
 *
 * **Benefícios:**
 * - Torna o código testável (permite mock fácil do window)
 * - Compatível com SSR sem erros de "window is not defined"
 * - Centraliza a detecção de ambiente browser vs servidor
 *
 * **Uso:**
 * ```typescript
 * constructor(@Inject(WINDOW) private window: Window) {
 *   if (this.window.location) {
 *     console.log(this.window.location.href);
 *   }
 * }
 * ```
 *
 * **Em testes:**
 * ```typescript
 * const mockWindow = { location: { origin: 'http://test.com' } } as Window;
 * TestBed.configureTestingModule({
 *   providers: [{ provide: WINDOW, useValue: mockWindow }]
 * });
 * ```
 */
export const WINDOW = new InjectionToken<Window>('Window object', {
	providedIn: 'root',
	factory: () => {
		// Verifica se estamos em ambiente browser
		if (typeof window !== 'undefined') {
			return window;
		}

		// Fallback para SSR: retorna objeto vazio tipado como Window
		// Componentes devem verificar propriedades antes de usar
		return {} as Window;
	},
});
