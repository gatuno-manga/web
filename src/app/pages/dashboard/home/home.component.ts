import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	OnInit,
	PLATFORM_ID,
	signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { BookService } from '@core/services/book.service';
import { DashboardService } from '@core/services/dashboard.service';
import { MetaDataService } from '@core/services/meta-data.service';
import { MqttService } from '@core/services/mqtt.service';
import { UserTokenService } from '@core/services/user-token.service';
import {
	DashboardOverview,
	DashboardProgress,
	QueueStats,
} from '@models/dashboard.models';
import { IconsComponent } from '@ui/atoms/icons/icons.component';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

@Component({
	selector: 'app-home',
	standalone: true,
	imports: [CommonModule, IconsComponent, RouterModule, NgxEchartsDirective],
	templateUrl: './home.component.html',
	styleUrl: './home.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
	private readonly dashboardService = inject(DashboardService);
	private readonly bookService = inject(BookService);
	private readonly metaService = inject(MetaDataService);
	private readonly wsService = inject(MqttService);
	private readonly userTokenService = inject(UserTokenService);
	private readonly platformId = inject(PLATFORM_ID);

	isBrowser = isPlatformBrowser(this.platformId);

	overview = signal<DashboardOverview>({
		counts: {
			books: 0,
			chapters: 0,
			users: 0,
			pages: 0,
			authors: 0,
			tags: 0,
			sensitiveContent: 0,
		},
		status: { books: [], chapters: [] },
		sensitiveContent: [],
		tags: [],
	});

	progressBooks = signal<DashboardProgress>({
		totalChapters: 0,
		processingChapters: 0,
		books: [],
	});

	imageErrors = signal<Set<string>>(new Set());

	onImageError(bookId: string) {
		this.imageErrors.update((set) => {
			const newSet = new Set(set);
			newSet.add(bookId);
			return newSet;
		});
	}

	queueStats = signal<QueueStats>({ queues: [] });

	allActiveJobs = computed(() => {
		return (
			this.queueStats().queues?.flatMap((q) => q.activeJobs ?? []) ?? []
		);
	});

	allPendingJobs = computed(() => {
		return (
			this.queueStats().queues?.flatMap((q) => q.pendingJobs ?? []) ?? []
		);
	});

	// Charts Options as computed signals
	private readonly textColor = '#aaa';

	scrapingStatusChartOption = computed<EChartsOption>(() => {
		const data = this.overview().status.books.map((item) => ({
			value: item.count,
			name: item.status,
		}));
		return {
			title: {
				text: 'Status de Scraping (Livros)',
				left: 'center',
				textStyle: { color: this.textColor },
			},
			tooltip: { trigger: 'item' },
			series: [
				{
					name: 'Status',
					type: 'pie',
					radius: ['40%', '70%'],
					avoidLabelOverlap: false,
					itemStyle: {
						borderRadius: 10,
						borderColor: '#fff',
						borderWidth: 2,
					},
					label: { show: false, position: 'center' },
					emphasis: {
						label: {
							show: true,
							fontSize: '20',
							fontWeight: 'bold',
						},
					},
					labelLine: { show: false },
					data: data,
				},
			],
		};
	});

	chapterStatusChartOption = computed<EChartsOption>(() => {
		const data = this.overview().status.chapters.map((item) => ({
			value: item.count,
			name: item.status,
		}));
		return {
			title: {
				text: 'Status de Scraping (Capítulos)',
				left: 'center',
				textStyle: { color: this.textColor },
			},
			tooltip: { trigger: 'item' },
			series: [
				{
					name: 'Status',
					type: 'pie',
					radius: ['40%', '70%'],
					avoidLabelOverlap: false,
					itemStyle: {
						borderRadius: 10,
						borderColor: '#fff',
						borderWidth: 2,
					},
					label: { show: false, position: 'center' },
					emphasis: {
						label: {
							show: true,
							fontSize: '20',
							fontWeight: 'bold',
						},
					},
					labelLine: { show: false },
					data: data,
				},
			],
		};
	});

	sensitiveContentChartOption = computed<EChartsOption>(() => {
		const overview = this.overview();
		const names = overview.sensitiveContent.map((item) => item.name);
		const counts = overview.sensitiveContent.map((item) => item.count);

		return {
			title: {
				text: 'Distribuição de Conteúdo Sensível',
				left: 'center',
				textStyle: { color: this.textColor },
			},
			tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
			grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
			xAxis: [
				{
					type: 'category',
					data: names,
					axisTick: { alignWithLabel: true },
					axisLabel: { color: this.textColor, rotate: 45 },
				},
			],
			yAxis: [{ type: 'value', axisLabel: { color: this.textColor } }],
			series: [
				{
					name: 'Livros',
					type: 'bar',
					barWidth: '60%',
					data: counts,
					itemStyle: { color: '#d48265' },
				},
			],
		};
	});

	tagsChartOption = computed<EChartsOption>(() => {
		const overview = this.overview();
		const names = overview.tags
			? overview.tags.map((item) => item.name)
			: [];
		const counts = overview.tags
			? overview.tags.map((item) => item.count)
			: [];

		return {
			title: {
				text: 'Top 10 Tags',
				left: 'center',
				textStyle: { color: this.textColor },
			},
			tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
			grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
			xAxis: [
				{
					type: 'category',
					data: names,
					axisTick: { alignWithLabel: true },
					axisLabel: { color: this.textColor, rotate: 45 },
				},
			],
			yAxis: [{ type: 'value', axisLabel: { color: this.textColor } }],
			series: [
				{
					name: 'Livros',
					type: 'bar',
					barWidth: '60%',
					data: counts,
					itemStyle: { color: '#5470c6' },
				},
			],
		};
	});

	constructor() {
		this.setMetaData();

		if (this.isBrowser && this.userTokenService.isAdmin) {
			this.wsService.bookCreated$
				.pipe(takeUntilDestroyed())
				.subscribe(() => this.loadDashboardData());
			this.wsService.chaptersUpdated$
				.pipe(takeUntilDestroyed())
				.subscribe(() => this.loadDashboardData());
			this.wsService.chapterScrapingCompleted$
				.pipe(takeUntilDestroyed())
				.subscribe(() => this.loadDashboardData());
			this.wsService.chaptersFix$
				.pipe(takeUntilDestroyed())
				.subscribe(() => {});
		}
	}

	ngOnInit() {
		if (this.isBrowser) {
			this.loadDashboardData();

			if (this.userTokenService.isAdmin) {
				if (!this.wsService.isConnected()) {
					this.wsService.connect();
				}
			}
		}
	}

	private loadDashboardData(): void {
		this.dashboardService.getOverview().subscribe({
			next: (overview) => this.overview.set(overview),
			error: (error) =>
				console.error('Erro ao carregar overview do dashboard:', error),
		});

		this.dashboardService.getProgressBooks().subscribe({
			next: (progressBooks) => {
				const bookIds = progressBooks.books.map((b) => b.id);
				if (bookIds.length > 0) {
					this.bookService
						.getBooksBatchGraphQL(bookIds)
						.subscribe((graphqlBooks) => {
							const updatedBooks = progressBooks.books.map(
								(pb) => {
									const gb = graphqlBooks.find(
										(b) => b.id === pb.id,
									);
									if (gb) {
										return {
											...pb,
											cover: gb.cover,
											blurHash: gb.blurHash,
											dominantColor: gb.dominantColor,
										};
									}
									return pb;
								},
							);
							this.progressBooks.set({
								...progressBooks,
								books: updatedBooks,
							});
						});
				} else {
					this.progressBooks.set(progressBooks);
				}
			},
			error: (error) =>
				console.error(
					'❌ Erro ao carregar livros em processamento:',
					error,
				),
		});

		this.dashboardService.getQueueStats().subscribe({
			next: (stats) => this.queueStats.set(stats),
			error: (error) => console.error('❌ Erro ao carregar fila:', error),
		});
	}

	private setMetaData() {
		this.metaService.setMetaData({
			title: 'Dashboard',
			description:
				'Visão geral do seu painel. Acompanhe estatísticas, progresso e atividades recentes.',
		});
	}
}
