import { Component } from '@angular/core';
import { NotificationService } from '../notification.service';
import { NotificationSeverity } from './notification-strategy.interface';
import { ConfirmationNotificationComponent } from '../../components/notification/custom-components/confirmation-notification/confirmation-notification.component';
import { ProgressNotificationComponent } from '../../components/notification/custom-components/progress-notification/progress-notification.component';
import { SuccessDetailsNotificationComponent } from '../../components/notification/custom-components/success-details-notification/success-details-notification.component';

/**
 * Componente de exemplo demonstrando o uso do NotificationService
 * com o padrão Factory Method e componentes personalizados
 */
@Component({
    selector: 'app-notification-example',
    standalone: true,
    template: `
        <div class="examples">
            <h2>Exemplos de Notificações</h2>

            <section>
                <h3>Básico</h3>
                <button (click)="showSuccess()">Sucesso</button>
                <button (click)="showError()">Erro</button>
                <button (click)="showWarning()">Aviso</button>
            </section>

            <section>
                <h3>Diferentes Severidades</h3>
                <button (click)="showSimpleError()">Erro Simples</button>
                <button (click)="showCriticalError()">Erro Crítico</button>
            </section>

            <section>
                <h3>🎨 Componentes Personalizados</h3>
                <button (click)="showCustomConfirmation()">Confirmação Customizada</button>
                <button (click)="showCustomProgress()">Progresso Customizado</button>
                <button (click)="showCustomSuccess()">Sucesso com Detalhes</button>
            </section>
        </div>
    `,
    styles: [`
        .examples {
            padding: 20px;
        }

        section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        h3 {
            margin-top: 0;
        }

        button {
            margin: 5px;
            padding: 10px 15px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            background: #007bff;
            color: white;
            transition: background 0.2s;
        }

        button:hover {
            background: #0056b3;
        }
    `]
})
export class NotificationExampleComponent {
    constructor(private notificationService: NotificationService) {}

    // ==========================================
    // Exemplos básicos - Toast
    // ==========================================

    showSuccess(): void {
        this.notificationService.success('Operação realizada com sucesso!');
    }

    showError(): void {
        this.notificationService.error('Ocorreu um erro');
    }

    showWarning(): void {
        this.notificationService.warning('Atenção necessária');
    }

    // ==========================================
    // Diferentes severidades
    // ==========================================

    showSimpleError(): void {
        this.notificationService.error('Preencha todos os campos');
    }

    showCriticalError(): void {
        this.notificationService.critical(
            'Dados corrompidos! Ação necessária.',
            'ERRO CRÍTICO'
        );
    }

    // ==========================================
    // 🎨 NOVOS: Componentes Personalizados
    // ==========================================

    showCustomConfirmation(): void {
        this.notificationService.notify({
            message: '', // Não usado quando há componente personalizado
            level: 'warning',
            severity: NotificationSeverity.CRITICAL,
            component: ConfirmationNotificationComponent,
            componentData: {
                title: 'Confirmar Exclusão',
                message: 'Você está prestes a excluir os seguintes itens:',
                details: [
                    'Livro: "O Senhor dos Anéis"',
                    '15 capítulos',
                    '3 comentários de usuários'
                ],
                showWarning: true
            }
        });
    }

    showCustomProgress(): void {
        // Simula um progresso
        let progress = 0;

        const strategy = this.notificationService.notify({
            message: '',
            level: 'info',
            severity: NotificationSeverity.HIGH,
            dismissible: false,
            component: ProgressNotificationComponent,
            componentData: {
                title: 'Upload de Arquivos',
                progress: 0,
                statusMessage: 'Iniciando upload...',
                currentItem: 'arquivo1.pdf'
            }
        });

        // Simula atualização de progresso
        const interval = setInterval(() => {
            progress += 10;

            if (progress > 100) {
                clearInterval(interval);
                strategy.dismiss();
                this.showCustomSuccess();
                return;
            }

            // Atualiza a notificação (em implementação real,
            // você teria um método para atualizar o componente)
        }, 500);
    }

    showCustomSuccess(): void {
        this.notificationService.notify({
            message: '',
            level: 'success',
            severity: NotificationSeverity.HIGH,
            component: SuccessDetailsNotificationComponent,
            componentData: {
                title: 'Upload Concluído!',
                message: 'Todos os arquivos foram enviados com sucesso.',
                items: [
                    'documento1.pdf (2.3 MB)',
                    'imagem.jpg (1.1 MB)',
                    'planilha.xlsx (856 KB)'
                ],
                itemsTitle: 'Arquivos enviados',
                actionLabel: 'Ver Arquivos',
                actionCallback: () => {
                    console.log('Navegar para arquivos...');
                }
            }
        });
    }
}
