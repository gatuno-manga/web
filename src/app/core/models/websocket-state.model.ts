/**
 * Estados possíveis para uma conexão WebSocket.
 *
 * Define uma state machine explícita para gerenciar o ciclo de vida
 * da conexão, eliminando race conditions entre reconexão automática
 * do Socket.io e gerenciamento de rede da aplicação.
 */
export enum WebSocketConnectionState {
	/**
	 * Socket não está conectado e não há tentativa ativa.
	 * Estado inicial ou após desconexão manual.
	 */
	DISCONNECTED = 'DISCONNECTED',

	/**
	 * Tentativa de conexão inicial em progresso.
	 * Transição de DISCONNECTED após chamar connect().
	 */
	CONNECTING = 'CONNECTING',

	/**
	 * Conexão estabelecida com sucesso.
	 * Socket está pronto para enviar/receber eventos.
	 */
	CONNECTED = 'CONNECTED',

	/**
	 * Conexão perdida, tentando reconectar automaticamente.
	 * Socket.io está realizando tentativas de reconexão.
	 */
	RECONNECTING = 'RECONNECTING',

	/**
	 * Conexão pausada devido a rede offline.
	 * Reconexão automática desabilitada até rede voltar.
	 * Permite reconexão rápida quando NetworkStatusService detectar online.
	 */
	OFFLINE_PAUSED = 'OFFLINE_PAUSED',

	/**
	 * Erro fatal ou limite de tentativas de reconexão atingido.
	 * Requer intervenção manual ou nova chamada a connect().
	 */
	ERROR = 'ERROR',
}

/**
 * Mapa de transições válidas entre estados.
 *
 * Define quais mudanças de estado são permitidas, prevenindo
 * transições inválidas que poderiam causar comportamento imprevisível.
 *
 * **Exemplo de uso:**
 * ```typescript
 * const currentState = WebSocketConnectionState.CONNECTED;
 * const nextState = WebSocketConnectionState.RECONNECTING;
 *
 * if (STATE_TRANSITIONS[currentState]?.includes(nextState)) {
 *   this.connectionState.next(nextState);
 * } else {
 *   console.error(`Transição inválida: ${currentState} → ${nextState}`);
 * }
 * ```
 */
export const STATE_TRANSITIONS: Record<
	WebSocketConnectionState,
	WebSocketConnectionState[]
> = {
	[WebSocketConnectionState.DISCONNECTED]: [
		WebSocketConnectionState.CONNECTING,
		WebSocketConnectionState.RECONNECTING, // Se mqtt.js tentar reconectar automaticamente
	],

	[WebSocketConnectionState.CONNECTING]: [
		WebSocketConnectionState.CONNECTED,
		WebSocketConnectionState.ERROR,
		WebSocketConnectionState.OFFLINE_PAUSED,
		WebSocketConnectionState.DISCONNECTED, // Se cancelado
	],

	[WebSocketConnectionState.CONNECTED]: [
		WebSocketConnectionState.RECONNECTING,
		WebSocketConnectionState.OFFLINE_PAUSED,
		WebSocketConnectionState.DISCONNECTED,
	],

	[WebSocketConnectionState.RECONNECTING]: [
		WebSocketConnectionState.CONNECTED,
		WebSocketConnectionState.ERROR,
		WebSocketConnectionState.OFFLINE_PAUSED,
		WebSocketConnectionState.DISCONNECTED,
	],

	[WebSocketConnectionState.OFFLINE_PAUSED]: [
		WebSocketConnectionState.CONNECTING, // Quando rede volta
		WebSocketConnectionState.DISCONNECTED, // Se desconectar manualmente
	],

	[WebSocketConnectionState.ERROR]: [
		WebSocketConnectionState.CONNECTING, // Retry manual
		WebSocketConnectionState.DISCONNECTED,
	],
};

/**
 * Valida se uma transição de estado é permitida.
 *
 * @param currentState - Estado atual da conexão
 * @param nextState - Estado desejado
 * @returns true se a transição é válida, false caso contrário
 *
 * @example
 * ```typescript
 * if (isValidTransition(this.state, WebSocketConnectionState.CONNECTED)) {
 *   this.transitionTo(WebSocketConnectionState.CONNECTED);
 * }
 * ```
 */
export function isValidTransition(
	currentState: WebSocketConnectionState,
	nextState: WebSocketConnectionState,
): boolean {
	const allowedTransitions = STATE_TRANSITIONS[currentState] || [];
	return allowedTransitions.includes(nextState);
}
