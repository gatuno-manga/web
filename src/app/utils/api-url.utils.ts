export interface UrlConfig {
	isBrowser: boolean;
	apiUrl: string;
	apiUrlServer?: string;
	origin?: string;
}

export function buildApiUrl(path: string, config: UrlConfig): string {
	const isAbsoluteUrl = /^https?:\/\//i.test(path);
	const requestExclude = ['/assets/', '/data/'];

	if (
		isAbsoluteUrl ||
		requestExclude.some((exclude) => path.includes(exclude))
	) {
		return path;
	}

	let baseUrl = config.apiUrl;

	if (!config.isBrowser) {
		baseUrl =
			config.apiUrlServer || config.apiUrl || 'http://localhost:3000/api';
	} else if (!baseUrl) {
		baseUrl = `${config.origin || ''}/api`;
	}

	if (config.isBrowser && baseUrl && !baseUrl.startsWith('http')) {
		const protocol = window.location.protocol;
		// Se a baseUrl começa com /, assumimos que é um caminho relativo ao host atual
		if (baseUrl.startsWith('/')) {
			baseUrl = `${protocol}//${window.location.host}${baseUrl}`;
		} else {
			baseUrl = `${protocol}//${baseUrl}`;
		}
	}

	const cleanBase = baseUrl.replace(/\/+$/, '');
	const cleanPath = path.replace(/^\/+/, '');

	return `${cleanBase}/${cleanPath}`;
}

/**
 * Constrói a URL completa para conexão WebSocket (Socket.io).
 *
 * Remove o sufixo `/api` da URL base e adiciona o namespace especificado,
 * seguindo as convenções do Socket.io para namespaces.
 *
 * **Comportamento:**
 * - Remove trailing slashes da URL base
 * - Remove o sufixo `/api` se presente
 * - Adiciona o namespace (com ou sem `/` inicial)
 * - Respeita configurações de SSR (apiUrlServer vs apiUrl)
 * - Faz fallback para window.location.origin em ambiente browser
 *
 * **Exemplos:**
 * ```typescript
 * // Browser com apiURL = 'http://localhost:3000/api'
 * buildWebSocketUrl('books', config)
 * // → 'http://localhost:3000/books'
 *
 * // SSR com apiURLServer = 'http://api:3000/api'
 * buildWebSocketUrl('/reading-progress', config)
 * // → 'http://api:3000/reading-progress'
 *
 * // Browser sem apiURL (relativo)
 * buildWebSocketUrl('books', { isBrowser: true, apiUrl: '', origin: 'http://localhost:4200' })
 * // → 'http://localhost:4200/books'
 * ```
 *
 * @param namespace - Nome do namespace Socket.io (ex: 'books', '/reading-progress')
 * @param config - Configuração de URL (isBrowser, apiUrl, apiUrlServer, origin)
 * @returns URL completa para conexão WebSocket incluindo o namespace
 */
export function buildWebSocketUrl(
	namespace: string,
	config: UrlConfig,
): string {
	let baseUrl = config.apiUrl;

	// Em SSR, usar apiUrlServer se disponível
	if (!config.isBrowser) {
		baseUrl =
			config.apiUrlServer || config.apiUrl || 'http://localhost:3000/api';
	} else if (!baseUrl) {
		// Fallback para origem do browser se apiUrl não estiver definida
		baseUrl = `${config.origin || ''}/api`;
	}

	// Se estamos no browser e a URL não tem protocolo, adicionar
	if (config.isBrowser && baseUrl && !baseUrl.startsWith('http')) {
		const protocol = window.location.protocol;
		if (baseUrl.startsWith('/')) {
			baseUrl = `${protocol}//${window.location.host}${baseUrl}`;
		} else {
			baseUrl = `${protocol}//${baseUrl}`;
		}
	}

	// Remover trailing slashes e o sufixo /api para obter a raiz do servidor
	const serverRootUrl = baseUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');

	// Limpar namespace (remover / inicial para adicionar de forma consistente)
	const cleanNamespace = namespace.replace(/^\/+/, '');

	return `${serverRootUrl}/${cleanNamespace}`;
}
