import {
	Component,
	OnInit,
	OnDestroy,
	signal,
	inject,
	computed,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { IconsComponent } from '../../../components/icons/icons.component';
import { BookWebsocketService } from '../../../service/book-websocket.service';
import { DashboardService } from '../../../service/dashboard.service';
import {
	QueueStats,
	QueueCounts,
	RecentQueueEvent,
} from '../../../models/dashboard.models';
import {
	UpdateStartedEvent,
	UpdateCompletedEvent,
	UpdateFailedEvent,
} from '../../../models/book-events.model';
import { RouterModule } from '@angular/router';
import { ButtonComponent } from '../../../components/inputs/button/button.component';

const EMPTY_COUNTS: QueueCounts = {
	waiting: 0,
	active: 0,
	completed: 0,
	failed: 0,
	delayed: 0,
};
const EMPTY_QUEUE_STATS: QueueStats = { queues: [] };

const QUEUE_LABELS: Record<string, string> = {
	'book-update-queue': 'Atualização de Livros',
	'chapter-scraping': 'Scraping de Capítulos',
	'cover-image-queue': 'Imagens de Capa',
	'fix-chapter-queue': 'Correção de Capítulos',
};

@Component({
	selector: 'app-monitoring',
	standalone: true,
	imports: [CommonModule, IconsComponent, RouterModule, ButtonComponent],
	templateUrl: './monitoring.component.html',
	styleUrl: './monitoring.component.scss',
})
export class MonitoringComponent implements OnInit, OnDestroy {
	private dashboardService = inject(DashboardService);
	private wsService = inject(BookWebsocketService);
	private platformId = inject(PLATFORM_ID);

	queueStats = signal<QueueStats>(EMPTY_QUEUE_STATS);
	recentEvents = signal<RecentQueueEvent[]>([]);
	isLoading = signal(true);

	/** Soma de contagens de todas as filas */
	aggregateCounts = computed<QueueCounts>(() =>
		this.queueStats().queues.reduce(
			(acc, q) => ({
				waiting: acc.waiting + (q.counts.waiting ?? 0),
				active: acc.active + (q.counts.active ?? 0),
				completed: acc.completed + (q.counts.completed ?? 0),
				failed: acc.failed + (q.counts.failed ?? 0),
				delayed: acc.delayed + (q.counts.delayed ?? 0),
			}),
			{ ...EMPTY_COUNTS },
		),
	);

	/** Label legível para o nome da fila */
	queueLabel(name: string): string {
		return QUEUE_LABELS[name] ?? name;
	}

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
		for (const sub of this.wsSubscriptions) {
			sub.unsubscribe();
		}
		this.pollSubscription?.unsubscribe();
	}

	loadQueueStats() {
		this.dashboardService.getQueueStats().subscribe({
			next: (data) => {
				this.queueStats.set(data);
				this.isLoading.set(false);
			},
			error: (error) => {
				console.error('Erro ao carregar estatísticas:', error);
				this.isLoading.set(false);
			},
		});
	}

	setupWebSocket() {
		if (!this.wsService.isConnected()) {
			this.wsService.connect();
		}

		const startedSub = this.wsService.bookUpdateStarted$.subscribe(
			(event: UpdateStartedEvent) => {
				this.addRecentEvent({
					id: event.jobId,
					bookId: event.bookId,
					bookTitle: event.bookTitle,
					timestamp: event.timestamp,
					status: 'active',
				});
				this.loadQueueStats();
			},
		);

		const completedSub = this.wsService.bookUpdateCompleted$.subscribe(
			(event: UpdateCompletedEvent) => {
				this.addRecentEvent({
					id: event.jobId,
					bookId: event.bookId,
					bookTitle: event.bookTitle,
					timestamp: event.timestamp,
					status: 'completed',
				});
				this.loadQueueStats();
			},
		);

		const failedSub = this.wsService.bookUpdateFailed$.subscribe(
			(event: UpdateFailedEvent) => {
				this.addRecentEvent({
					id: event.jobId,
					bookId: event.bookId,
					bookTitle: event.bookTitle,
					timestamp: event.timestamp,
					status: 'failed',
				});
				this.loadQueueStats();
			},
		);

		this.wsSubscriptions.push(startedSub, completedSub, failedSub);
	}

	addRecentEvent(event: RecentQueueEvent) {
		const current = this.recentEvents();
		this.recentEvents.set([event, ...current].slice(0, 20));
	}

	startPolling() {
		this.pollSubscription = interval(10000).subscribe(() => {
			this.loadQueueStats();
		});
	}

	forceUpdateAll() {
		this.dashboardService.forceUpdateAll().subscribe({
			next: () => setTimeout(() => this.loadQueueStats(), 1000),
			error: (error: unknown) =>
				console.error('Erro ao forçar atualização:', error),
		});
	}

	getStatusIcon(status?: string): string {
		switch (status) {
			case 'active':
				return 'loader';
			case 'completed':
				return 'check-circle';
			case 'failed':
				return 'x-circle';
			default:
				return 'clock';
		}
	}

	getStatusClass(status?: string): string {
		switch (status) {
			case 'active':
				return 'status-active';
			case 'completed':
				return 'status-completed';
			case 'failed':
				return 'status-failed';
			default:
				return 'status-waiting';
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
