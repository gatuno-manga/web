import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { IconsComponent } from '../../../components/icons/icons.component';
import { BookWebsocketService } from '../../../service/book-websocket.service';
import { UpdateStartedEvent, UpdateCompletedEvent, UpdateFailedEvent } from '../../../models/book-events.model';
import { RouterModule } from '@angular/router';
import { ButtonComponent } from '../../../components/inputs/button/button.component';

interface QueueCounts {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}

interface JobInfo {
    id: string;
    bookId: string;
    bookTitle: string;
    timestamp?: number;
    status?: 'active' | 'completed' | 'failed';
}

interface QueueStats {
    counts: QueueCounts;
    activeJobs: JobInfo[];
    waitingJobs: JobInfo[];
}

@Component({
    selector: 'app-monitoring',
    standalone: true,
    imports: [CommonModule, IconsComponent, RouterModule, ButtonComponent],
    templateUrl: './monitoring.component.html',
    styleUrl: './monitoring.component.scss'
})
export class MonitoringComponent implements OnInit, OnDestroy {
    private http = inject(HttpClient);
    private wsService = inject(BookWebsocketService);
    private platformId = inject(PLATFORM_ID);

    queueStats = signal<QueueStats>({
        counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
        activeJobs: [],
        waitingJobs: []
    });

    recentEvents = signal<JobInfo[]>([]);
    isLoading = signal(true);

    private wsSubscriptions: Subscription[] = [];
    private pollSubscription?: Subscription;

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            this.loadQueueStats();
            this.setupWebSocket();
            this.startPolling();
        }
    }

    ngOnDestroy() {
        this.wsSubscriptions.forEach(sub => sub.unsubscribe());
        this.pollSubscription?.unsubscribe();
    }

    loadQueueStats() {
        this.http.get<QueueStats>('books/dashboard/queue-stats').subscribe({
            next: (data) => {
                this.queueStats.set(data);
                this.isLoading.set(false);
            },
            error: (error) => {
                console.error('Erro ao carregar estatísticas:', error);
                this.isLoading.set(false);
            }
        });
    }

    setupWebSocket() {
        // Conectar ao WebSocket se não estiver conectado
        if (!this.wsService.isConnected()) {
            this.wsService.connect();
        }

        // Listener para atualização iniciada
        const startedSub = this.wsService.bookUpdateStarted$.subscribe((event: UpdateStartedEvent) => {
            console.log('📊 Update started:', event);
            this.addRecentEvent({
                id: event.jobId,
                bookId: event.bookId,
                bookTitle: event.bookTitle,
                timestamp: event.timestamp,
                status: 'active'
            });
            // Recarregar estatísticas
            this.loadQueueStats();
        });

        // Listener para atualização concluída
        const completedSub = this.wsService.bookUpdateCompleted$.subscribe((event: UpdateCompletedEvent) => {
            console.log('✅ Update completed:', event);
            this.addRecentEvent({
                id: event.jobId,
                bookId: event.bookId,
                bookTitle: event.bookTitle,
                timestamp: event.timestamp,
                status: 'completed'
            });
            // Recarregar estatísticas
            this.loadQueueStats();
        });

        // Listener para atualização falha
        const failedSub = this.wsService.bookUpdateFailed$.subscribe((event: UpdateFailedEvent) => {
            console.error('❌ Update failed:', event);
            this.addRecentEvent({
                id: event.jobId,
                bookId: event.bookId,
                bookTitle: event.bookTitle,
                timestamp: event.timestamp,
                status: 'failed'
            });
            // Recarregar estatísticas
            this.loadQueueStats();
        });

        this.wsSubscriptions.push(startedSub, completedSub, failedSub);
    }

    addRecentEvent(event: JobInfo) {
        const current = this.recentEvents();
        this.recentEvents.set([event, ...current].slice(0, 20)); // Mantém apenas os 20 mais recentes
    }

    startPolling() {
        // Atualiza a cada 10 segundos
        this.pollSubscription = interval(10000).subscribe(() => {
            this.loadQueueStats();
        });
    }

    forceUpdateAll() {
        this.http.post('books/check-all-updates', {}).subscribe({
            next: () => {
                console.log('✅ Atualização forçada de todos os livros');
                setTimeout(() => this.loadQueueStats(), 1000);
            },
            error: (error) => {
                console.error('❌ Erro ao forçar atualização:', error);
            }
        });
    }

    getStatusIcon(status?: string): string {
        switch (status) {
            case 'active': return 'loader';
            case 'completed': return 'check-circle';
            case 'failed': return 'x-circle';
            default: return 'clock';
        }
    }

    getStatusClass(status?: string): string {
        switch (status) {
            case 'active': return 'status-active';
            case 'completed': return 'status-completed';
            case 'failed': return 'status-failed';
            default: return 'status-waiting';
        }
    }

    formatTimestamp(timestamp?: number): string {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h atrás`;
        if (minutes > 0) return `${minutes}m atrás`;
        return `${seconds}s atrás`;
    }
}
