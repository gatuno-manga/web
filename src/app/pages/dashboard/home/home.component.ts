import {
	Component,
	OnInit,
	OnDestroy,
	inject,
	PLATFORM_ID,
	ChangeDetectorRef,
	NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { IconsComponent } from '../../../components/icons/icons.component';
import { DashboardService } from '../../../service/dashboard.service';
import {
	DashboardOverview,
	DashboardProgress,
} from '../../../models/dashboard.models';
import { RouterModule } from '@angular/router';
import { MetaDataService } from '../../../service/meta-data.service';
import { BookWebsocketService } from '../../../service/book-websocket.service';
import { UserTokenService } from '../../../service/user-token.service';
import { Subscription } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';

@Component({
	selector: 'app-home',
	standalone: true,
	imports: [CommonModule, IconsComponent, RouterModule, NgxEchartsDirective],
	templateUrl: './home.component.html',
	styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
	// Inicialização padrão compatível com a nova estrutura
	overview: DashboardOverview = {
		counts: {
			books: 0,
			chapters: 0,
			users: 0,
			pages: 0,
			authors: 0,
			tags: 0,
			sensitiveContent: 0,
		},
		status: {
			books: [],
			chapters: [],
		},
		sensitiveContent: [],
		tags: [],
	};

	progressBooks: DashboardProgress = {
		totalChapters: 0,
		processingChapters: 0,
		books: [],
	};

	scrapingStatusChartOption: EChartsOption = {};
	chapterStatusChartOption: EChartsOption = {};
	sensitiveContentChartOption: EChartsOption = {};
	tagsChartOption: EChartsOption = {};

	isBrowser = false;

	private wsSubscriptions: Subscription[] = [];
	private platformId = inject(PLATFORM_ID);
	private cdr = inject(ChangeDetectorRef);
	private ngZone = inject(NgZone);

	constructor(
		private readonly dashboardService: DashboardService,
		private metaService: MetaDataService,
		private wsService: BookWebsocketService,
		private userTokenService: UserTokenService,
	) {
		this.setMetaData();
		this.isBrowser = isPlatformBrowser(this.platformId);
	}

	ngOnInit() {
		if (this.isBrowser) {
			this.loadDashboardData();

			if (this.userTokenService.isAdmin) {
				this.setupWebSocket();
			}
		}
	}

	ngOnDestroy() {
		for (const sub of this.wsSubscriptions) {
			sub.unsubscribe();
		}
	}

	private setupWebSocket() {
		if (!this.wsService.isConnected()) {
			this.wsService.connect();
		}

		this.wsSubscriptions.push(
			this.wsService.bookCreated$.subscribe((book) => {
				this.loadDashboardData();
			}),

			this.wsService.chaptersUpdated$.subscribe((data) => {
				this.loadDashboardData();
			}),

			this.wsService.chapterScrapingCompleted$.subscribe((data) => {
				this.loadDashboardData();
			}),

			this.wsService.chaptersFix$.subscribe((data) => {
				// Chapter fix event
			}),
		);
	}

	private loadDashboardData(): void {
		console.log('🔄 Carregando dados do dashboard...');

		this.dashboardService.getOverview().subscribe({
			next: (overview: DashboardOverview) => {
				this.ngZone.run(() => {
					console.log('✅ Dados do dashboard recebidos:', overview);
					console.log('📊 Total de livros:', overview.counts.books);
					console.log(
						'📖 Total de capítulos:',
						overview.counts.chapters,
					);

					this.overview = overview;
					console.log('✅ Overview atribuído à propriedade');

					this.setupCharts(overview);
					console.log('✅ Charts configurados');

					// Forçar detecção de mudanças
					this.cdr.detectChanges();
					console.log('✅ Change detection forçado');

					console.log('📦 Estado final do overview:', this.overview);
				});
			},
			error: (error: Error) => {
				console.error('Erro ao carregar overview do dashboard:', error);
			},
		});

		this.dashboardService.getProgressBooks().subscribe({
			next: (progressBooks: DashboardProgress) => {
				this.ngZone.run(() => {
					this.progressBooks = progressBooks;
					this.cdr.detectChanges();
				});
			},
			error: (error: Error) => {
				console.error(
					'❌ Erro ao carregar livros em processamento:',
					error,
				);
			},
		});
	}

	setMetaData() {
		this.metaService.setMetaData({
			title: 'Dashboard',
			description:
				'Visão geral do seu painel. Acompanhe estatísticas, progresso e atividades recentes.',
		});
	}

	setupCharts(data: DashboardOverview) {
		const textColor = '#aaa';

		// Gráfico de Status dos Livros
		const bookStatusData = data.status.books.map((item) => ({
			value: item.count,
			name: item.status,
		}));

		this.scrapingStatusChartOption = {
			title: {
				text: 'Status de Scraping (Livros)',
				left: 'center',
				textStyle: { color: textColor },
			},
			tooltip: {
				trigger: 'item',
			},
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
					label: {
						show: false,
						position: 'center',
					},
					emphasis: {
						label: {
							show: true,
							fontSize: '20',
							fontWeight: 'bold',
						},
					},
					labelLine: {
						show: false,
					},
					data: bookStatusData,
				},
			],
		};

		// Gráfico de Status dos Capítulos
		const chapterStatusData = data.status.chapters.map((item) => ({
			value: item.count,
			name: item.status,
		}));

		this.chapterStatusChartOption = {
			title: {
				text: 'Status de Scraping (Capítulos)',
				left: 'center',
				textStyle: { color: textColor },
			},
			tooltip: {
				trigger: 'item',
			},
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
					label: {
						show: false,
						position: 'center',
					},
					emphasis: {
						label: {
							show: true,
							fontSize: '20',
							fontWeight: 'bold',
						},
					},
					labelLine: {
						show: false,
					},
					data: chapterStatusData,
				},
			],
		};

		// Gráfico de Conteúdo Sensível (Bar Chart)
		const sensitiveContentNames = data.sensitiveContent.map(
			(item) => item.name,
		);
		const sensitiveContentCounts = data.sensitiveContent.map(
			(item) => item.count,
		);

		this.sensitiveContentChartOption = {
			title: {
				text: 'Distribuição de Conteúdo Sensível',
				left: 'center',
				textStyle: { color: textColor },
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: {
					type: 'shadow',
				},
			},
			grid: {
				left: '3%',
				right: '4%',
				bottom: '3%',
				containLabel: true,
			},
			xAxis: [
				{
					type: 'category',
					data: sensitiveContentNames,
					axisTick: {
						alignWithLabel: true,
					},
					axisLabel: {
						color: textColor,
						rotate: 45,
					},
				},
			],
			yAxis: [
				{
					type: 'value',
					axisLabel: {
						color: textColor,
					},
				},
			],
			series: [
				{
					name: 'Livros',
					type: 'bar',
					barWidth: '60%',
					data: sensitiveContentCounts,
					itemStyle: {
						color: '#d48265',
					},
				},
			],
		};

		// Gráfico de Tags (Bar Chart)
		const tagNames = data.tags ? data.tags.map((item) => item.name) : [];
		const tagCounts = data.tags ? data.tags.map((item) => item.count) : [];

		this.tagsChartOption = {
			title: {
				text: 'Top 10 Tags',
				left: 'center',
				textStyle: { color: textColor },
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: {
					type: 'shadow',
				},
			},
			grid: {
				left: '3%',
				right: '4%',
				bottom: '3%',
				containLabel: true,
			},
			xAxis: [
				{
					type: 'category',
					data: tagNames,
					axisTick: {
						alignWithLabel: true,
					},
					axisLabel: {
						color: textColor,
						rotate: 45,
					},
				},
			],
			yAxis: [
				{
					type: 'value',
					axisLabel: {
						color: textColor,
					},
				},
			],
			series: [
				{
					name: 'Livros',
					type: 'bar',
					barWidth: '60%',
					data: tagCounts,
					itemStyle: {
						color: '#5470c6',
					},
				},
			],
		};
	}
}
