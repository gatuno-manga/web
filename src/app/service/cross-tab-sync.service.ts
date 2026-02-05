import { Injectable, inject, PLATFORM_ID, OnDestroy, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';

export interface AuthSyncMessage {
    type: 'TOKEN_UPDATE' | 'TOKEN_REMOVE';
    accessToken?: string | null;
    timestamp: number;
}

@Injectable({
    providedIn: 'root'
})
export class CrossTabSyncService implements OnDestroy {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly ngZone = inject(NgZone);
    private readonly isBrowser: boolean;

    private readonly CHANNEL_NAME = 'gatuno-auth-sync';
    private readonly STORAGE_KEY = '@gatuno/auth-sync';

    private broadcastChannel: BroadcastChannel | null = null;
    private storageListener: ((event: StorageEvent) => void) | null = null;
    private readonly useBroadcastChannel: boolean;

    private readonly _messages$ = new Subject<AuthSyncMessage>();
    public readonly messages$ = this._messages$.asObservable();

    constructor() {
        this.isBrowser = isPlatformBrowser(this.platformId);

        if (!this.isBrowser) {
            this.useBroadcastChannel = false;
            return;
        }

        this.useBroadcastChannel = typeof BroadcastChannel !== 'undefined';

        if (this.useBroadcastChannel) {
            this.initBroadcastChannel();
        } else {
            this.initStorageEventFallback();
        }
    }

    private initBroadcastChannel(): void {
        this.ngZone.runOutsideAngular(() => {
            this.broadcastChannel = new BroadcastChannel(this.CHANNEL_NAME);

            this.broadcastChannel.onmessage = (event: MessageEvent<AuthSyncMessage>) => {
                this.ngZone.run(() => {
                    this._messages$.next(event.data);
                });
            };
        });
    }

    private initStorageEventFallback(): void {
        this.ngZone.runOutsideAngular(() => {
            this.storageListener = (event: StorageEvent) => {
                if (event.key !== this.STORAGE_KEY || !event.newValue) {
                    return;
                }

                try {
                    const message: AuthSyncMessage = JSON.parse(event.newValue);
                    this.ngZone.run(() => {
                        this._messages$.next(message);
                    });
                } catch (e) {
                    console.warn('[CrossTabSync] Failed to parse storage event:', e);
                }
            };

            window.addEventListener('storage', this.storageListener);
        });
    }

    notifyTokenUpdate(accessToken: string | null): void {
        this.postMessage({
            type: 'TOKEN_UPDATE',
            accessToken,
            timestamp: Date.now()
        });
    }

    notifyTokenRemove(): void {
        this.postMessage({
            type: 'TOKEN_REMOVE',
            accessToken: null,
            timestamp: Date.now()
        });
    }

    private postMessage(message: AuthSyncMessage): void {
        if (!this.isBrowser) return;

        if (this.useBroadcastChannel && this.broadcastChannel) {
            this.broadcastChannel.postMessage(message);
        } else {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(message));
                localStorage.removeItem(this.STORAGE_KEY);
            } catch (e) {
                console.warn('[CrossTabSync] Failed to post message via storage:', e);
            }
        }
    }

    get isUsingBroadcastChannel(): boolean {
        return this.useBroadcastChannel;
    }

    ngOnDestroy(): void {
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
            this.broadcastChannel = null;
        }

        if (this.storageListener) {
            window.removeEventListener('storage', this.storageListener);
            this.storageListener = null;
        }

        this._messages$.complete();
    }
}
