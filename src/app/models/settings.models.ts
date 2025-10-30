export interface ReaderSettings {
    grayScale: boolean;
    asidePosition: 'left' | 'right';
    progressBarPosition?: 'top' | 'bottom';
    showPageNumbers: boolean;
    brightness?: number;
    contrast?: number;
    invert?: number;
    nightMode?: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
    grayScale: false,
    asidePosition: 'right',
    progressBarPosition: 'top',
    showPageNumbers: false,
    brightness: 100,
    contrast: 100,
    invert: 0,
    nightMode: false
};
