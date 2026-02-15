import { ManagerOptions, SocketOptions } from 'socket.io-client';

/**
 * Opções customizáveis para configuração de conexão Socket.io.
 *
 * Permite sobrescrever valores padrão para casos específicos,
 * mantendo configuração consistente entre serviços.
 */
export interface SocketConfigOptions {
	/**
	 * Número de tentativas de reconexão antes de desistir.
	 * @default 5
	 */
	reconnectionAttempts: number;

	/**
	 * Delay inicial entre tentativas de reconexão (ms).
	 * @default 1000
	 */
	reconnectionDelay: number;

	/**
	 * Delay máximo entre tentativas de reconexão (ms).
	 * @default 5000
	 */
	reconnectionDelayMax: number;

	/**
	 * Timeout para conexão inicial (ms).
	 * @default 10000
	 */
	timeout: number;

	/**
	 * Transports permitidos (ordem de preferência).
	 * @default ['websocket', 'polling']
	 */
	transports: string[];

	/**
	 * Se true, sempre cria uma nova conexão em vez de reutilizar.
	 * @default true
	 */
	forceNew: boolean;

	/**
	 * Se true, conecta automaticamente ao criar o socket.
	 * @default true
	 */
	autoConnect: boolean;
}

/**
 * Valores padrão para configuração Socket.io.
 *
 * Otimizados para latência baixa e reconexão resiliente:
 * - WebSocket primeiro (menor latência)
 * - Fallback para polling (compatibilidade)
 * - 5 tentativas de reconexão com backoff exponencial
 * - Timeout de 10s (adequado para redes lentas)
 */
const DEFAULT_CONFIG: SocketConfigOptions = {
	reconnectionAttempts: 5,
	reconnectionDelay: 1000,
	reconnectionDelayMax: 5000,
	timeout: 10000,
	transports: ['websocket', 'polling'],
	forceNew: true,
	autoConnect: true,
};

/**
 * Cria um objeto de configuração Socket.io com valores padrão consistentes.
 *
 * Esta função centraliza toda a configuração de conexão Socket.io, garantindo
 * comportamento uniforme entre diferentes serviços WebSocket da aplicação.
 *
 * **Configuração Padrão:**
 * - `transports`: ['websocket', 'polling'] - WebSocket preferencial com fallback
 * - `reconnection`: true - Reconexão automática habilitada
 * - `reconnectionDelay`: 1000ms - Delay inicial entre tentativas
 * - `reconnectionDelayMax`: 5000ms - Delay máximo (backoff exponencial)
 * - `reconnectionAttempts`: 5 - Tentativas antes de desistir
 * - `timeout`: 10000ms - Timeout para handshake inicial
 * - `forceNew`: true - Sempre cria nova conexão (evita reutilização problemática)
 * - `autoConnect`: true - Conecta imediatamente ao instanciar
 *
 * **Autenticação:**
 * O token JWT é enviado no handshake inicial através do campo `auth`,
 * permitindo que o servidor valide a identidade antes de aceitar a conexão.
 *
 * **Customização:**
 * Use o parâmetro `options` para sobrescrever valores específicos:
 * ```typescript
 * // Aumentar tentativas de reconexão para serviço crítico
 * const config = getSocketConfig(token, { reconnectionAttempts: 10 });
 *
 * // Desabilitar autoConnect para controle manual
 * const config = getSocketConfig(token, { autoConnect: false });
 * ```
 *
 * **Exemplo de Uso:**
 * ```typescript
 * const token = this.userTokenService.accessToken;
 * const config = getSocketConfig(token);
 * const socket = io('http://localhost:3000/books', config);
 * ```
 *
 * @param token - Token JWT para autenticação no servidor
 * @param options - Opções customizadas (sobrescreve padrões)
 * @returns Objeto de configuração completo para Socket.io
 */
export function getSocketConfig(
	token: string,
	options?: Partial<SocketConfigOptions>,
): Partial<ManagerOptions & SocketOptions> {
	// Mescla opções customizadas com padrões
	const config: SocketConfigOptions = {
		...DEFAULT_CONFIG,
		...options,
	};

	return {
		// Autenticação JWT enviada no handshake
		auth: {
			token,
		},

		// Transports (ordem de preferência)
		transports: config.transports,

		// Configuração de reconexão
		reconnection: true, // Sempre habilitado (gerenciado por state machine)
		reconnectionDelay: config.reconnectionDelay,
		reconnectionDelayMax: config.reconnectionDelayMax,
		reconnectionAttempts: config.reconnectionAttempts,

		// Timeout para conexão inicial
		timeout: config.timeout,

		// Comportamento de conexão
		forceNew: config.forceNew,
		autoConnect: config.autoConnect,
	};
}
