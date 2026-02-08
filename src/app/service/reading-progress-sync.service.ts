import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject, firstValueFrom, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserTokenService } from './user-token.service';
import { ReadingProgressService, ReadingProgress } from './reading-progress.service';
import { NetworkStatusService } from './network-status.service';

export interface RemoteReadingProgress {
    id: string;
    chapterId: string;
    bookId: string;
    pageIndex: number;
    totalPages: number;
    completed: boolean;
    updatedAt: Date;
}

export interface SyncStatus {
    connected: boolean;
    syncing: boolean;
    lastSyncAt: Date | null;
    pendingChanges: number;
}

interface SaveProgressDto {
    chapterId: string;
    bookId: string;
    pageIndex: number;
    totalPages?: number;
    completed?: boolean;
}

interface SyncConflict {
    local: SaveProgressDto;
    remote: RemoteReadingProgress;
}

interface SyncResponse {
    synced: RemoteReadingProgress[];
    conflicts: SyncConflict[];
    lastSyncAt: Date;
}

export interface SyncReadingProgressDto {
    progress: SaveProgressDto[];
    lastSyncAt?: Date;
}

/**
 * Service para sincronização de progresso de leitura com o backend via WebSocket
 *
 * Features:
 * - Sincronização em tempo real via WebSocket
 * - Fallback para HTTP quando WebSocket não disponível
 * - Queue de mudanças pendentes para sincronização offline
 * - Sincronização entre múltiplos dispositivos
 * - Resolução automática de conflitos (maior página vence)
 */
@Injectable({
    providedIn: 'root'
})
export class ReadingProgressSyncService implements OnDestroy {
    private socket: Socket | null = null;
    private isBrowser: boolean;
    private pendingChanges: Map<string, SaveProgressDto> = new Map();
    private syncSubscription: Subscription | null = null;
    private networkSubscription: Subscription | null = null;

    // Estado da sincronização
    private syncStatusSubject = new BehaviorSubject<SyncStatus>({
        connected: false,
        syncing: false,
        lastSyncAt: null,
        pendingChanges: 0
    });

    // Eventos
    private progressSyncedSubject = new Subject<RemoteReadingProgress>();
    private progressDeletedSubject = new Subject<{ chapterId: string }>();
    private errorSubject = new Subject<{ message: string }>();

    // Observables públicos
    public syncStatus$ = this.syncStatusSubject.asObservable();
    public progressSynced$ = this.progressSyncedSubject.asObservable();
    public progressDeleted$ = this.progressDeletedSubject.asObservable();
    public error$ = this.errorSubject.asObservable();

    constructor(
        @Inject(PLATFORM_ID) platformId: Object,
        private http: HttpClient,
        private userTokenService: UserTokenService,
        private localProgressService: ReadingProgressService,
        private networkStatusService: NetworkStatusService
    ) {
        this.isBrowser = isPlatformBrowser(platformId);

        if (this.isBrowser) {
            // Escuta mudanças de autenticação
            this.setupAuthListener();
            // Escuta mudanças de rede
            this.setupNetworkListener();
        }
    }

    ngOnDestroy(): void {
        this.disconnect();
        this.syncSubscription?.unsubscribe();
        this.networkSubscription?.unsubscribe();
    }

    /**
     * Escuta mudanças de rede para desconectar quando offline
     */
    private setupNetworkListener(): void {
        this.networkSubscription = this.networkStatusService.wentOffline$.subscribe(() => {
            console.log('📡 Rede offline - desconectando WebSocket de sincronização');
            this.disconnectForOffline();
        });
    }

    /**
     * Desconecta o WebSocket quando fica offline
     */
    private disconnectForOffline(): void {
        if (this.socket) {
            // Desabilita reconexão automática antes de desconectar
            this.socket.io.opts.reconnection = false;
            this.socket.disconnect();
            this.socket = null;
            this.updateSyncStatus({ connected: false });
            console.log('🔌 WebSocket de sincronização desconectado (modo offline)');
        }
    }

    /**
     * Conecta ao WebSocket de sincronização
     */
    connect(): void {
        if (!this.isBrowser) return;

        if (this.socket?.connected) {
            console.log('🔌 WebSocket de sincronização já conectado');
            return;
        }

        const token = this.userTokenService.accessToken;
        if (!token) {
            console.warn('⚠️ Token não disponível. Sincronização não iniciada.');
            return;
        }

        const serverUrl = environment.apiURL.replace('/api', '');
        console.log('🔌 Conectando ao WebSocket de sincronização:', `${serverUrl}/reading-progress`);

        this.socket = io(`${serverUrl}/reading-progress`, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            timeout: 10000,
            forceNew: true,
            autoConnect: true,
        });

        this.setupSocketListeners();
    }

    /**
     * Desconecta do WebSocket
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.updateSyncStatus({ connected: false });
            console.log('🔌 WebSocket de sincronização desconectado');
        }
    }

    /**
     * Verifica se está conectado
     */
    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    /**
     * Salva e sincroniza o progresso de leitura
     */
    async saveProgress(
        chapterId: string,
        bookId: string,
        pageIndex: number,
        totalPages?: number,
        completed?: boolean
    ): Promise<void> {
        // Salva localmente primeiro (offline-first)
        await this.localProgressService.saveProgress(chapterId, bookId, pageIndex);

        const progressData: SaveProgressDto = {
            chapterId,
            bookId,
            pageIndex,
            totalPages,
            completed
        };

        if (this.socket?.connected) {
            // Envia via WebSocket
            this.socket.emit('progress:update', progressData);
        } else {
            // Adiciona à fila de pendentes
            this.pendingChanges.set(chapterId, progressData);
            this.updateSyncStatus({ pendingChanges: this.pendingChanges.size });

            // Tenta sincronizar via HTTP
            this.syncViaHttp(progressData);
        }
    }

    /**
     * Obtém o progresso de um capítulo (local + remoto)
     */
    async getProgress(chapterId: string): Promise<ReadingProgress | undefined> {
        // Primeiro tenta obter localmente
        const localProgress = await this.localProgressService.getProgress(chapterId);

        if (this.socket?.connected) {
            // Solicita do servidor
            return new Promise((resolve) => {
                this.socket!.emit('progress:chapter', { chapterId });

                const timeout = setTimeout(() => {
                    resolve(localProgress);
                }, 3000);

                this.socket!.once('progress:chapter:response', (data: { chapterId: string; progress: RemoteReadingProgress | null }) => {
                    clearTimeout(timeout);
                    if (data.progress) {
                        // Compara e retorna o mais recente
                        if (!localProgress || data.progress.pageIndex >= localProgress.pageIndex) {
                            const userId = this.localProgressService.getCurrentUserId();
                            resolve(this.remoteToLocal(data.progress, userId));
                        } else {
                            resolve(localProgress);
                        }
                    } else {
                        resolve(localProgress);
                    }
                });
            });
        }

        return localProgress;
    }

    /**
     * Sincroniza todo o progresso com o servidor
     */
    async syncAll(): Promise<void> {
        if (!this.isBrowser) return;

        this.updateSyncStatus({ syncing: true });

        try {
            if (this.socket?.connected) {
                // Solicita sincronização completa via WebSocket
                this.socket.emit('progress:sync');
            } else {
                // Fallback para HTTP
                await this.syncAllViaHttp();
            }
        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
            this.errorSubject.next({ message: 'Falha na sincronização' });
        } finally {
            this.updateSyncStatus({ syncing: false });
        }
    }

    /**
     * Sincroniza mudanças pendentes
     */
    async syncPendingChanges(): Promise<void> {
        if (this.pendingChanges.size === 0) return;

        const pendingArray = Array.from(this.pendingChanges.values());

        for (const progress of pendingArray) {
            try {
                if (this.socket?.connected) {
                    this.socket.emit('progress:update', progress);
                } else {
                    await this.syncViaHttp(progress);
                }
                this.pendingChanges.delete(progress.chapterId);
            } catch (error) {
                console.error(`❌ Erro ao sincronizar ${progress.chapterId}:`, error);
            }
        }

        this.updateSyncStatus({ pendingChanges: this.pendingChanges.size });
    }

    /**
     * Sincroniza uma lista de progressos em lote com o servidor
     */
    async uploadProgress(progress: SaveProgressDto[]): Promise<void> {
        if (progress.length === 0) return;

        try {
            await this.syncBulkViaHttp(progress);
            // Remove da lista de pendentes os itens que foram sincronizados
            for (const item of progress) {
                this.pendingChanges.delete(item.chapterId);
            }
            this.updateSyncStatus({
                pendingChanges: this.pendingChanges.size,
                lastSyncAt: new Date()
            });
        } catch (error) {
            console.error('❌ Erro ao sincronizar progresso em lote:', error);
            throw error;
        }
    }

    // ==================== MÉTODOS PRIVADOS ====================

    private async syncBulkViaHttp(progress: SaveProgressDto[]): Promise<SyncResponse> {
        const dto: SyncReadingProgressDto = {
            progress,
            lastSyncAt: this.syncStatusSubject.value.lastSyncAt || undefined
        };

        try {
            const response = await firstValueFrom(
                this.http.post<SyncResponse>(
                    'reading-progress/sync',
                    dto
                )
            );
            console.log(`✅ ${progress.length} itens sincronizados em lote via HTTP`);
            return response;
        } catch (error) {
            console.error('❌ Erro na sincronização em lote via HTTP:', error);
            throw error;
        }
    }

    private setupSocketListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ WebSocket de sincronização conectado:', this.socket?.id);
            this.updateSyncStatus({ connected: true });

            // Sincroniza mudanças pendentes
            this.syncPendingChanges();

            // Solicita sincronização completa
            this.syncAll();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('⚠️ WebSocket de sincronização desconectado:', reason);
            this.updateSyncStatus({ connected: false });
        });

        this.socket.on('connect_error', (error: any) => {
            console.error('❌ Erro de conexão WebSocket:', error.message);
            this.updateSyncStatus({ connected: false });
        });

        this.socket.on('connected', (data: { message: string; userId: string }) => {
            console.log('🔗 Conectado ao serviço de sincronização:', data.message);
        });

        // Progresso salvo com sucesso
        this.socket.on('progress:saved', (progress: RemoteReadingProgress) => {
            console.log('✅ Progresso salvo no servidor:', progress.chapterId);
            this.pendingChanges.delete(progress.chapterId);
            this.updateSyncStatus({
                pendingChanges: this.pendingChanges.size,
                lastSyncAt: new Date()
            });
        });

        // Progresso sincronizado de outro dispositivo
        this.socket.on('progress:synced', async (progress: RemoteReadingProgress) => {
            console.log('🔄 Progresso sincronizado de outro dispositivo:', progress.chapterId);

            // Atualiza localmente
            await this.localProgressService.saveProgress(
                progress.chapterId,
                progress.bookId,
                progress.pageIndex
            );

            this.progressSyncedSubject.next(progress);
        });

        // Sincronização completa recebida
        this.socket.on('progress:sync:complete', async (data: { progress: RemoteReadingProgress[]; syncedAt: Date }) => {
            console.log(`📥 Sincronização completa recebida: ${data.progress.length} itens`);

            // Atualiza todos os itens localmente
            for (const progress of data.progress) {
                const localProgress = await this.localProgressService.getProgress(progress.chapterId);

                // Só atualiza se o remoto for mais recente
                if (!localProgress || progress.pageIndex >= localProgress.pageIndex) {
                    await this.localProgressService.saveProgress(
                        progress.chapterId,
                        progress.bookId,
                        progress.pageIndex
                    );
                }
            }

            this.updateSyncStatus({
                syncing: false,
                lastSyncAt: new Date(data.syncedAt)
            });
        });

        // Progresso deletado
        this.socket.on('progress:deleted', async (data: { chapterId: string }) => {
            console.log('🗑️ Progresso deletado:', data.chapterId);
            await this.localProgressService.deleteProgress(data.chapterId);
            this.progressDeletedSubject.next(data);
        });

        // Erros
        this.socket.on('error', (error: { message: string }) => {
            console.error('❌ Erro do servidor:', error.message);
            this.errorSubject.next(error);
        });
    }

    private async syncViaHttp(progress: SaveProgressDto): Promise<void> {
        try {
            await firstValueFrom(
                this.http.post<RemoteReadingProgress>(
                    'reading-progress',
                    progress
                )
            );
            console.log('✅ Progresso sincronizado via HTTP:', progress.chapterId);
        } catch (error) {
            console.error('❌ Erro ao sincronizar via HTTP:', error);
            throw error;
        }
    }

    private async syncAllViaHttp(): Promise<void> {
        try {
            const remoteProgress = await firstValueFrom(
                this.http.get<RemoteReadingProgress[]>('reading-progress')
            );

            for (const progress of remoteProgress) {
                const localProgress = await this.localProgressService.getProgress(progress.chapterId);

                if (!localProgress || progress.pageIndex >= localProgress.pageIndex) {
                    await this.localProgressService.saveProgress(
                        progress.chapterId,
                        progress.bookId,
                        progress.pageIndex
                    );
                }
            }

            this.updateSyncStatus({ lastSyncAt: new Date() });
            console.log(`📥 Sincronização HTTP completa: ${remoteProgress.length} itens`);
        } catch (error) {
            console.error('❌ Erro na sincronização HTTP:', error);
            throw error;
        }
    }

    private setupAuthListener(): void {
        // Verifica se há token válido ao inicializar
        if (this.userTokenService.hasValidAccessToken) {
            setTimeout(() => this.connect(), 500);
        }
    }

    private updateSyncStatus(partial: Partial<SyncStatus>): void {
        this.syncStatusSubject.next({
            ...this.syncStatusSubject.value,
            ...partial
        });
    }

    private remoteToLocal(remote: RemoteReadingProgress, userId: string): ReadingProgress {
        return {
            id: `${userId}_${remote.chapterId}`,
            chapterId: remote.chapterId,
            bookId: remote.bookId,
            userId: userId,
            pageIndex: remote.pageIndex,
            updatedAt: new Date(remote.updatedAt)
        };
    }
}
