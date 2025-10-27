export interface ReaderSettings {
    grayScale: boolean;
    asidePosition: 'left' | 'right';
    showPageNumbers: boolean;
    brightness?: number;
    contrast?: number;
    invert?: number;
    nightMode?: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
    grayScale: false,
    asidePosition: 'right',
    showPageNumbers: false,
    brightness: 100,
    contrast: 100,
    invert: 0,
    nightMode: false
};
