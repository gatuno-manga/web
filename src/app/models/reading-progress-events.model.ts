/**
 * Modelo de dados para progresso de leitura remoto (servidor).
 */
export interface RemoteReadingProgress {
	id: string;
	userId: string;
	chapterId: string;
	bookId: string;
	pageIndex: number;
	timestamp: Date;
	version: number;
	totalPages?: number;
	completed?: boolean;
	updatedAt?: Date;
}

/**
 * DTO para salvar progresso de leitura no servidor.
 */
export interface SaveProgressDto {
	chapterId: string;
	bookId: string;
	pageIndex: number;
	timestamp: number;
	totalPages?: number;
	completed?: boolean;
}

/**
 * DTO para sincronizar progresso de leitura.
 */
export interface SyncReadingProgressDto {
	progress: SaveProgressDto[];
	lastSyncAt?: Date;
}

/**
 * Status de sincronização de progresso.
 */
export type SyncStatus = 'idle' | 'syncing' | 'error';

/**
 * Resposta de sincronização do servidor.
 */
export interface SyncResponse {
	success: boolean;
	progress?: RemoteReadingProgress;
	conflict?: SyncConflict;
	error?: string;
}

/**
 * Representa um conflito de sincronização entre cliente e servidor.
 */
export interface SyncConflict {
	local: {
		chapterId: string;
		pageIndex: number;
		timestamp: number;
	};
	remote: {
		chapterId: string;
		pageIndex: number;
		timestamp: number;
	};
}

/**
 * Evento de atualização de progresso broadcast pelo servidor.
 */
export interface ProgressUpdatedEvent {
	chapterId: string;
	pageIndex: number;
	timestamp: number;
}

/**
 * Mapeamento de tipos para eventos do servidor → cliente (reading-progress namespace).
 *
 * Define a assinatura de cada evento que o servidor pode emitir
 * no namespace /reading-progress.
 */
export interface ReadingProgressServerToClientEvents {
	/**
	 * Emitido quando o progresso de leitura é atualizado em outro dispositivo/tab.
	 * Permite sincronização em tempo real entre múltiplas sessões.
	 */
	'progress:updated': (event: ProgressUpdatedEvent) => void;

	/**
	 * Resposta a uma solicitação de sincronização.
	 */
	'progress:synced': (response: SyncResponse) => void;

	/**
	 * Emitido quando há um conflito de sincronização que requer resolução.
	 */
	'progress:conflict': (conflict: SyncConflict) => void;

	/**
	 * Confirmação de que o servidor conectou com sucesso.
	 */
	connected: (data: { message: string; userId: string }) => void;

	/**
	 * Progresso salvo com sucesso no servidor.
	 */
	'progress:saved': (progress: RemoteReadingProgress) => void;

	/**
	 * Sincronização completa recebida do servidor.
	 */
	'progress:sync:complete': (data: {
		progress: RemoteReadingProgress[];
		syncedAt: Date;
	}) => void;

	/**
	 * Progresso deletado no servidor.
	 */
	'progress:deleted': (data: { chapterId: string }) => void;

	/**
	 * Resposta à solicitação de progresso de um capítulo específico.
	 */
	'progress:chapter:response': (data: {
		chapterId: string;
		progress: RemoteReadingProgress | null;
	}) => void;

	/**
	 * Erro genérico do servidor.
	 */
	error: (error: { message: string }) => void;
}

/**
 * Mapeamento de tipos para eventos do cliente → servidor (reading-progress namespace).
 *
 * Define a assinatura de cada comando que o cliente pode enviar
 * para o namespace /reading-progress.
 */
export interface ReadingProgressClientToServerEvents {
	/**
	 * Solicita sincronização do progresso de leitura.
	 */
	'sync:progress': (
		data: SyncReadingProgressDto,
		callback?: (response: SyncResponse) => void,
	) => void;

	/**
	 * Salva o progresso de leitura no servidor.
	 */
	'save:progress': (data: SaveProgressDto) => void;

	/**
	 * Atualiza o progresso de leitura.
	 */
	'progress:update': (data: SaveProgressDto) => void;

	/**
	 * Solicita sincronização completa.
	 */
	'progress:sync': () => void;

	/**
	 * Obtém o progresso de um capítulo específico.
	 */
	'progress:chapter': (data: { chapterId: string }) => void;

	/**
	 * Obtém o progresso de leitura mais recente do servidor (callback).
	 */
	'get:progress': (
		chapterId: string,
		callback: (progress: RemoteReadingProgress | null) => void,
	) => void;
}
