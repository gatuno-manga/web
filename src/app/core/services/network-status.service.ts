import {
    Injectable,
    PLATFORM_ID,
    inject,
    signal,
    computed,
    OnDestroy,
    NgZone
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';

/**
 * NetworkStatusService - Serviço centralizado para detecção de estado de rede.
 *
 * Fornece:
 * - Signal `isOnline()` para checagem síncrona e reativa
 * - Observable `status$` para composição com RxJS
 * - Computed `isOffline()` como conveniência
 *
 * Gerencia listeners globais de `window.online/offline` e é SSR-safe.
 *
 * @example
 * ```typescript
 * // Em componentes (signal-based)
 * networkStatus = inject(NetworkStatusService);
 * @if (networkStatus.isOffline()) { <offline-banner /> }
 *
 * // Em guards (síncrono)
 * if (!networkStatus.isOnline()) { return false; }
 *
 * // Com RxJS
 * networkStatus.status$.pipe(filter(online => !online)).subscribe(...)
 * ```
 */
@Injectable({
    providedIn: 'root'
})
export class NetworkStatusService implements OnDestroy {
    private platformId = inject(PLATFORM_ID);
    private ngZone = inject(NgZone);
    private router = inject(Router);

    /** Signal reativo indicando se há conexão de rede */
    private _isOnline = signal(true);

    /** Indica se estava offline antes da última mudança de estado */
    private wasOffline = false;

    /** Signal público (readonly) para estado online */
    readonly isOnline = this._isOnline.asReadonly();

    /** Computed para conveniência - inverso de isOnline */
    readonly isOffline = computed(() => !this._isOnline());

    /** Observable para integração com RxJS */
    readonly status$: Observable<boolean>;

    /** Subject que emite quando fica offline - usado para desconectar WebSockets */
    private _wentOffline$ = new Subject<void>();
    readonly wentOffline$ = this._wentOffline$.asObservable();

    /** Subject que emite quando volta online - usado para reconectar WebSockets */
    private _wentOnline$ = new Subject<void>();
    readonly wentOnline$ = this._wentOnline$.asObservable();

    private onlineHandler = () => this.handleOnline();
    private offlineHandler = () => this.handleOffline();

    constructor() {
        // Inicializa observable a partir do signal
        this.status$ = toObservable(this._isOnline);

        if (isPlatformBrowser(this.platformId)) {
            // Define estado inicial baseado no navigator
            const initialStatus = navigator.onLine;
            this._isOnline.set(initialStatus);
            this.wasOffline = !initialStatus;

            // Registra listeners globais
            window.addEventListener('online', this.onlineHandler);
            window.addEventListener('offline', this.offlineHandler);
        }
    }

    ngOnDestroy() {
        if (isPlatformBrowser(this.platformId)) {
            window.removeEventListener('online', this.onlineHandler);
            window.removeEventListener('offline', this.offlineHandler);
        }
    }

    /**
     * Atualiza o estado de rede dentro da zona Angular
     * para garantir change detection adequada.
     */
    private updateStatus(online: boolean) {
        this.ngZone.run(() => {
            this._isOnline.set(online);
        });
    }

    /**
     * Handler para quando a conexão é restaurada.
     * Recarrega a página automaticamente, exceto se o usuário
     * estiver na página de chapters lendo um livro.
     */
    private handleOnline() {
        this.updateStatus(true);

        // Só recarrega se estava offline antes
        if (this.wasOffline) {
            this.wasOffline = false;

            // Emite evento para reconectar WebSockets
            this._wentOnline$.next();

            // Não recarrega se estiver na página de chapters
            const currentUrl = this.router.url;
            const isOnChaptersPage = currentUrl.includes('/chapters/');

            if (!isOnChaptersPage) {
                window.location.reload();
            }
        }
    }

    /**
     * Handler para quando a conexão é perdida.
     * Emite evento para desconectar WebSockets e evitar tentativas de reconexão.
     */
    private handleOffline() {
        this.wasOffline = true;
        this.updateStatus(false);

        // Emite evento para desconectar WebSockets
        this._wentOffline$.next();
    }

    /**
     * Força uma verificação do estado atual do navigator.
     * Útil após operações que podem ter restaurado a conexão.
     */
    refresh(): boolean {
        if (isPlatformBrowser(this.platformId)) {
            const currentStatus = navigator.onLine;
            this._isOnline.set(currentStatus);
            return currentStatus;
        }
        return true;
    }
}
