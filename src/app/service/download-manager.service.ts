import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserTokenService } from './user-token.service';
import { NotificationService } from './notification.service';

export interface DownloadTask {
    id: string;
    bookId: string;
    bookTitle: string;
    format: 'images' | 'pdfs';
    status: 'pending' | 'downloading' | 'completed' | 'error';
    progress: number;
    loaded: number;
    total: number;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    abortController?: AbortController;
}

@Injectable({
    providedIn: 'root'
})
export class DownloadManagerService {
    private tasks = new Map<string, DownloadTask>();

    // Observable para componentes se inscreverem
    private tasksSubject = new BehaviorSubject<DownloadTask[]>([]);
    public tasks$ = this.tasksSubject.asObservable();

    // Notificação quando um download completa
    private downloadCompleted = new Subject<DownloadTask>();
    public downloadCompleted$ = this.downloadCompleted.asObservable();

    constructor(
        private userTokenService: UserTokenService,
        private notificationService: NotificationService,
    ) {}

    /**
     * Inicia um download em background
     */
    startDownload(
        bookId: string,
        bookTitle: string,
        format: 'images' | 'pdfs',
        chapterIds: string[] = []
    ): string {
        const taskId = `${bookId}-${format}-${Date.now()}`;
        const abortController = new AbortController();

        const task: DownloadTask = {
            id: taskId,
            bookId,
            bookTitle,
            format,
            status: 'pending',
            progress: 0,
            loaded: 0,
            total: 0,
            startedAt: new Date(),
            abortController,
        };

        this.tasks.set(taskId, task);
        this.emitTasks();

        // Iniciar download em background
        this.executeDownload(task, chapterIds);

        return taskId;
    }

    /**
     * Cancela um download em andamento
     */
    cancelDownload(taskId: string): void {
        const task = this.tasks.get(taskId);
        if (task && task.abortController) {
            task.abortController.abort();
            task.status = 'error';
            task.error = 'Cancelado pelo usuário';
            this.emitTasks();

            this.notificationService.info(
                `Download de "${task.bookTitle}" foi cancelado.`,
                'Download cancelado'
            );
        }
    }

    /**
     * Remove um download da lista (só para completed/error)
     */
    removeTask(taskId: string): void {
        const task = this.tasks.get(taskId);
        if (task && (task.status === 'completed' || task.status === 'error')) {
            this.tasks.delete(taskId);
            this.emitTasks();
        }
    }

    /**
     * Retorna tarefa por ID
     */
    getTask(taskId: string): DownloadTask | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Retorna downloads ativos
     */
    getActiveDownloads(): DownloadTask[] {
        return Array.from(this.tasks.values()).filter(
            t => t.status === 'pending' || t.status === 'downloading'
        );
    }

    /**
     * Executa o download usando Fetch API com streaming
     */
    private async executeDownload(task: DownloadTask, chapterIds: string[]): Promise<void> {
        try {
            task.status = 'downloading';
            this.emitTasks();

            const token = this.userTokenService.accessToken;
            const baseUrl = environment.apiURL || (window.location.origin + '/api');
            const url = `${baseUrl.replace(/\/+$/, '')}/books/${task.bookId}/download`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    chapterIds: chapterIds,
                    format: task.format === 'pdfs' ? 'pdfs' : 'images'
                }),
                signal: task.abortController?.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Extrair Content-Length para progresso
            const contentLength = response.headers.get('Content-Length');
            task.total = contentLength ? parseInt(contentLength, 10) : 0;

            if (!response.body) {
                throw new Error('ReadableStream não suportado');
            }

            // Ler stream em chunks
            const reader = response.body.getReader();
            const chunks: BlobPart[] = [];

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                task.loaded += value.length;

                if (task.total > 0) {
                    task.progress = Math.round((task.loaded / task.total) * 100);
                }

                this.emitTasks();
            }

            // Montar blob final
            const blob = new Blob(chunks, { type: 'application/zip' });

            if (blob.size === 0) {
                throw new Error('Arquivo vazio recebido do servidor');
            }

            // Trigger download
            const formatLabel = task.format === 'pdfs' ? 'pdfs' : 'images';
            const fileName = `${task.bookTitle}-${formatLabel}.zip`;

            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => {
                window.URL.revokeObjectURL(downloadUrl);
            }, 100);

            // Marcar como completo
            task.status = 'completed';
            task.completedAt = new Date();
            task.progress = 100;
            this.emitTasks();

            this.downloadCompleted.next(task);

            this.notificationService.success(
                `Download de "${fileName}" concluído com sucesso!`,
                'Download completo'
            );

        } catch (error: any) {
            if (error.name === 'AbortError') {
                // Já tratado no cancelDownload
                return;
            }

            task.status = 'error';
            task.error = error?.message || 'Erro desconhecido';
            this.emitTasks();

            this.notificationService.error(
                `Não foi possível fazer o download de "${task.bookTitle}". ${task.error}`,
                'Erro no download'
            );
        }
    }

    private emitTasks(): void {
        this.tasksSubject.next(Array.from(this.tasks.values()));
    }
}
