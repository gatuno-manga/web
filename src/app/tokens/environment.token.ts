import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Interface que define a estrutura do objeto de configuração do ambiente.
 */
export interface Environment {
	production: boolean;
	apiURL: string;
	apiURLServer?: string;
}

/**
 * Token de injeção para o objeto de configuração do ambiente.
 *
 * Fornece acesso ao objeto `environment` através de injeção de dependência,
 * facilitando testes e permitindo substituição em diferentes contextos.
 *
 * **Benefícios:**
 * - Torna configurações testáveis (permite mock fácil do environment)
 * - Permite diferentes configurações por módulo/componente
 * - Facilita debugging de variáveis de ambiente
 * - Desacopla código da importação direta do environment
 *
 * **Uso:**
 * ```typescript
 * constructor(@Inject(ENVIRONMENT) private env: Environment) {
 *   console.log('API URL:', this.env.apiURL);
 * }
 * ```
 *
 * **Em testes:**
 * ```typescript
 * const mockEnv: Environment = {
 *   production: false,
 *   apiURL: 'http://localhost:3000/api',
 *   apiURLServer: 'http://api:3000/api'
 * };
 * TestBed.configureTestingModule({
 *   providers: [{ provide: ENVIRONMENT, useValue: mockEnv }]
 * });
 * ```
 */
export const ENVIRONMENT = new InjectionToken<Environment>(
	'Environment configuration',
	{
		providedIn: 'root',
		factory: () => environment,
	},
);
