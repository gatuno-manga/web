import { environment } from '@environments/environment';
import { WebSocketConnectionState } from '@models/websocket-state.model';

/**
 * Níveis de log disponíveis.
 */
export enum LogLevel {
	DEBUG = 'DEBUG',
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
}

/**
 * Configuração de logging para WebSocket.
 */
interface LogConfig {
	/** Se true, logs serão impressos no console */
	enabled: boolean;

	/** Nível mínimo de log a ser exibido */
	level: LogLevel;

	/** Se true, inclui timestamp nos logs */
	includeTimestamp: boolean;
}

/**
 * Configuração padrão baseada no ambiente.
 *
 * - **Desenvolvimento**: Todos os logs habilitados (DEBUG)
 * - **Produção**: Apenas WARN e ERROR
 */
const DEFAULT_CONFIG: LogConfig = {
	enabled: !environment.production,
	level: environment.production ? LogLevel.WARN : LogLevel.DEBUG,
	includeTimestamp: true,
};

/**
 * Mapa de níveis de log para métodos console.
 */
const LOG_METHODS: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
	[LogLevel.DEBUG]: 'debug',
	[LogLevel.INFO]: 'info',
	[LogLevel.WARN]: 'warn',
	[LogLevel.ERROR]: 'error',
};

/**
 * Emojis para diferentes tipos de eventos WebSocket.
 */
const EVENT_EMOJIS: Record<string, string> = {
	connect: '🔌',
	connected: '✅',
	disconnect: '🔌',
	disconnected: '❌',
	reconnect: '🔄',
	reconnecting: '🔄',
	error: '⚠️',
	event: '📨',
	subscribe: '👂',
	unsubscribe: '🔇',
	offline: '📡',
	online: '📡',
	state: '🔀',
};

/**
 * Hierarquia de níveis de log (para comparação).
 */
const LOG_LEVEL_HIERARCHY: Record<LogLevel, number> = {
	[LogLevel.DEBUG]: 0,
	[LogLevel.INFO]: 1,
	[LogLevel.WARN]: 2,
	[LogLevel.ERROR]: 3,
};

/**
 * Verifica se um nível de log deve ser exibido baseado na configuração.
 */
function shouldLog(
	level: LogLevel,
	config: LogConfig = DEFAULT_CONFIG,
): boolean {
	if (!config.enabled) {
		return false;
	}
	return LOG_LEVEL_HIERARCHY[level] >= LOG_LEVEL_HIERARCHY[config.level];
}

/**
 * Formata uma mensagem de log com timestamp e prefixo.
 */
function formatMessage(
	serviceName: string,
	event: string,
	message: string,
	config: LogConfig = DEFAULT_CONFIG,
): string {
	const emoji = EVENT_EMOJIS[event.toLowerCase()] || '🔸';
	const timestamp = config.includeTimestamp
		? `[${new Date().toLocaleTimeString()}]`
		: '';

	return `${timestamp} ${emoji} [${serviceName}] ${event}: ${message}`.trim();
}

/**
 * Loga um evento de conexão WebSocket com formatação consistente.
 *
 * Controla automaticamente a verbosidade baseado no ambiente:
 * - **Desenvolvimento**: Todos os logs visíveis
 * - **Produção**: Apenas warnings e erros
 *
 * **Exemplos:**
 * ```typescript
 * // Log de conexão bem-sucedida (INFO)
 * logConnectionEvent('BookWebsocket', 'connected', { url: 'http://localhost:3000/books' });
 *
 * // Log de erro (ERROR)
 * logConnectionEvent('ReadingProgress', 'error', { message: 'Timeout' }, LogLevel.ERROR);
 *
 * // Log de debug com detalhes
 * logConnectionEvent('BookWebsocket', 'subscribe', { bookId: '123' }, LogLevel.DEBUG);
 * ```
 *
 * @param serviceName - Nome do serviço WebSocket (ex: 'BookWebsocket', 'ReadingProgressSync')
 * @param event - Tipo de evento (ex: 'connect', 'error', 'subscribe')
 * @param details - Informações adicionais sobre o evento (opcional)
 * @param level - Nível de log (padrão: INFO)
 * @param config - Configuração de log customizada (opcional)
 */
export function logConnectionEvent(
	serviceName: string,
	event: string,
	details?: unknown,
	level: LogLevel = LogLevel.INFO,
	config: LogConfig = DEFAULT_CONFIG,
): void {
	if (!shouldLog(level, config)) {
		return;
	}

	const method = LOG_METHODS[level];
	let message = '';

	// Formatar mensagem baseado no tipo de evento
	if (details) {
		if (typeof details === 'string') {
			message = details;
		} else if (typeof details === 'object' && details !== null) {
			const d = details as {
				error?: unknown;
				url?: unknown;
				state?: unknown;
			};
			if (d.error) {
				message = `${d.error}`;
			} else if (d.url) {
				message = `URL: ${d.url}`;
			} else if (d.state) {
				message = `Estado: ${d.state}`;
			} else {
				message = JSON.stringify(details, null, 2);
			}
		}
	}

	const formattedMessage = formatMessage(serviceName, event, message, config);
	console[method](formattedMessage);

	// Em modo DEBUG, também loga o objeto completo se houver detalhes
	if (level === LogLevel.DEBUG && details && typeof details === 'object') {
		console[method]('Detalhes:', details);
	}
}

/**
 * Loga uma transição de estado da conexão WebSocket.
 *
 * Atalho especializado para logs de mudança de estado,
 * facilitando rastreamento do ciclo de vida da conexão.
 *
 * @param serviceName - Nome do serviço WebSocket
 * @param fromState - Estado anterior
 * @param toState - Novo estado
 * @param reason - Motivo da transição (opcional)
 * @param config - Configuração de log customizada (opcional)
 *
 * @example
 * ```typescript
 * logStateTransition(
 *   'BookWebsocket',
 *   WebSocketConnectionState.CONNECTING,
 *   WebSocketConnectionState.CONNECTED,
 *   'Handshake bem-sucedido'
 * );
 * ```
 */
export function logStateTransition(
	serviceName: string,
	fromState: WebSocketConnectionState,
	toState: WebSocketConnectionState,
	reason?: string,
	config: LogConfig = DEFAULT_CONFIG,
): void {
	const message = reason
		? `${fromState} → ${toState} (${reason})`
		: `${fromState} → ${toState}`;

	logConnectionEvent(serviceName, 'state', message, LogLevel.DEBUG, config);
}

/**
 * Loga um erro de WebSocket com stack trace.
 *
 * Sempre exibido, mesmo em produção (nível ERROR).
 *
 * @param serviceName - Nome do serviço WebSocket
 * @param error - Erro capturado
 * @param context - Contexto adicional sobre quando/onde o erro ocorreu
 * @param config - Configuração de log customizada (opcional)
 *
 * @example
 * ```typescript
 * try {
 *   socket.connect();
 * } catch (error) {
 *   logWebSocketError('BookWebsocket', error, 'Falha ao conectar');
 * }
 * ```
 */
export function logWebSocketError(
	serviceName: string,
	error: unknown,
	context?: string,
	config: LogConfig = DEFAULT_CONFIG,
): void {
	const err = error as { message?: string; stack?: string };
	const message = context
		? `${context}: ${err?.message || error}`
		: err?.message || error;

	logConnectionEvent(serviceName, 'error', message, LogLevel.ERROR, config);

	// Em desenvolvimento, loga stack trace se disponível
	if (!environment.production && err?.stack) {
		console.error('Stack trace:', err.stack);
	}
}
